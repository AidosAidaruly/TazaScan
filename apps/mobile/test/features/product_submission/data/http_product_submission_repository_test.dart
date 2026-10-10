import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/features/product_submission/data/repositories/http_product_submission_repository.dart';
import 'package:project/src/features/product_submission/domain/entities/product_submission_draft.dart';

void main() {
  test('maps OCR unreadable image response to safe Russian message', () async {
    final repository = HttpProductSubmissionRepository(
      MockClient(
        (_) async => http.Response(
          '{"error":{"message":"Unsupported image format"}}',
          415,
        ),
      ),
    );
    final image = await _temporaryImage();

    await expectLater(
      repository.recognizeNutrition(image),
      throwsA(
        isA<ServerException>().having(
          (error) => error.message,
          'message',
          'Не удалось открыть изображение. Попробуй выбрать другое фото.',
        ),
      ),
    );
  });

  test('maps submission oversized image response separately', () async {
    final repository = HttpProductSubmissionRepository(
      MockClient((_) async => http.Response('', 413)),
    );
    final image = await _temporaryImage();

    await expectLater(
      repository.recognizeIngredients(image),
      throwsA(
        isA<ServerException>().having(
          (error) => error.message,
          'message',
          'Фото слишком большое.',
        ),
      ),
    );
  });

  Future<Object> failure(
    Future<Object?> Function(HttpProductSubmissionRepository repository) call,
    int status,
    String body,
  ) async {
    final repository = HttpProductSubmissionRepository(
      MockClient((_) async => http.Response(body, status)),
    );
    try {
      await call(repository);
    } on Object catch (error) {
      return error;
    }
    fail('expected failure for $status');
  }

  Matcher kind(ApiErrorKind kind) =>
      isA<ServerException>().having((error) => error.kind, 'kind', kind);

  test('OCR busy and OCR timeout map to distinct kinds', () async {
    final image = await _temporaryImage();

    expect(
      await failure((repo) => repo.recognizeNutrition(image), 503,
          '{"error":{"message":"OCR service is busy. Try again later."}}'),
      kind(ApiErrorKind.ocrBusy),
    );
    expect(
      await failure((repo) => repo.recognizeIngredients(image), 504,
          '{"error":{"message":"OCR timed out"}}'),
      kind(ApiErrorKind.ocrTimeout),
    );
  });

  test('a malformed OCR success body is an invalid response, not a TypeError', () async {
    final image = await _temporaryImage();

    expect(
      await failure((repo) => repo.recognizeNutrition(image), 200, '{"data":{"nutrition":"oops"}}'),
      isA<InvalidResponseException>(),
    );
  });

  test('submit maps JSON 400 to validation and 409 to conflict', () async {
    const draft = ProductSubmissionDraft(name: 'Cola');

    expect(
      await failure((repo) => repo.submit(draft), 400, '{"error":{"message":"Validation failed"}}'),
      isA<ServerException>()
          .having((error) => error.kind, 'kind', ApiErrorKind.validation)
          .having((error) => error.message, 'message', isNot(contains('Validation failed'))),
    );
    expect(
      await failure((repo) => repo.submit(draft), 409,
          '{"error":{"message":"A similar pending submission already exists"}}'),
      kind(ApiErrorKind.conflict),
    );
  });

  test('submit maps an HTML 502 to a controlled server error', () async {
    const draft = ProductSubmissionDraft(name: 'Cola');

    expect(
      await failure((repo) => repo.submit(draft), 502, '<html><body>502 Bad Gateway</body></html>'),
      kind(ApiErrorKind.serverUnavailable),
    );
  });
}

Future<XFile> _temporaryImage() async {
  final file = File('${Directory.systemTemp.path}/tazascan-submission-test.jpg');
  await file.writeAsBytes([1, 2, 3], flush: true);
  return XFile(file.path);
}
