import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/features/photo_search/data/repositories/http_photo_search_repository.dart';

void main() {
  test('maps unreadable image response to safe Russian message', () async {
    final repository = HttpPhotoSearchRepository(
      MockClient(
        (_) async => http.Response(
          '{"error":{"message":"Unsupported image format"}}',
          415,
        ),
      ),
    );
    final image = await _temporaryImage();

    await expectLater(
      repository.searchByImage(image),
      throwsA(
        isA<ServerException>().having(
          (error) => error.message,
          'message',
          'Не удалось открыть изображение. Попробуйте выбрать другое фото.',
        ),
      ),
    );
  });

  test('maps oversized image response separately', () async {
    final repository = HttpPhotoSearchRepository(
      MockClient((_) async => http.Response('', 413)),
    );
    final image = await _temporaryImage();

    await expectLater(
      repository.searchByImage(image),
      throwsA(
        isA<ServerException>().having(
          (error) => error.message,
          'message',
          'Фото слишком большое.',
        ),
      ),
    );
  });

  Future<Object> failureFor(int status, String body) async {
    final repository = HttpPhotoSearchRepository(
      MockClient((_) async => http.Response(body, status)),
    );
    try {
      await repository.searchByImage(await _temporaryImage());
    } on Object catch (error) {
      return error;
    }
    fail('expected failure for $status');
  }

  test('HTML 413 from a proxy becomes file-too-large', () async {
    final error = await failureFor(413, '<html><body>413 Request Entity Too Large</body></html>');

    expect(
      error,
      isA<ServerException>()
          .having((error) => error.kind, 'kind', ApiErrorKind.payloadTooLarge)
          .having((error) => error.message, 'message', 'Фото слишком большое.'),
    );
  });

  test('OCR busy (JSON 503) and OCR timeout (504) are distinct', () async {
    final busy = await failureFor(503, '{"error":{"message":"OCR service is busy. Try again later."}}');
    final timeout = await failureFor(504, '{"error":{"message":"OCR timed out"}}');

    expect(busy, isA<ServerException>().having((error) => error.kind, 'kind', ApiErrorKind.ocrBusy));
    expect(timeout, isA<ServerException>().having((error) => error.kind, 'kind', ApiErrorKind.ocrTimeout));
  });

  test('HTML 502/503 pages become controlled server errors', () async {
    for (final status in [502, 503]) {
      final error = await failureFor(status, '<html><body>$status nginx</body></html>');

      expect(
        error,
        isA<ServerException>()
            .having((error) => error.kind, 'kind', ApiErrorKind.serverUnavailable)
            .having((error) => error.message, 'message', isNot(contains('nginx'))),
      );
    }
  });

  test('429 is rate-limited, not the backend English text', () async {
    final error = await failureFor(429, '{"error":{"message":"Too many photo searches. Try again later."}}');

    expect(
      error,
      isA<ServerException>()
          .having((error) => error.kind, 'kind', ApiErrorKind.rateLimited)
          .having((error) => error.message, 'message', isNot(contains('Too many'))),
    );
  });

  test('a success body with the wrong shape is an invalid response', () async {
    expect(await failureFor(200, '{"data":["not-a-product"]}'), isA<InvalidResponseException>());
  });

  test('an HTML 413 with invalid UTF-8 is still file-too-large', () async {
    final repository = HttpPhotoSearchRepository(
      MockClient(
        (_) async => http.Response.bytes(
          [...'<html>413 '.codeUnits, 0xff, 0xfe, ...'</html>'.codeUnits],
          413,
        ),
      ),
    );

    await expectLater(
      repository.searchByImage(await _temporaryImage()),
      throwsA(
        isA<ServerException>().having((error) => error.kind, 'kind', ApiErrorKind.payloadTooLarge),
      ),
    );
  });

  test('a dropped connection is NetworkException', () async {
    final repository = HttpPhotoSearchRepository(
      MockClient((_) async => throw http.ClientException('connection closed')),
    );

    await expectLater(
      repository.searchByImage(await _temporaryImage()),
      throwsA(isA<NetworkException>()),
    );
  });
}

Future<XFile> _temporaryImage() async {
  final file = File(
    '${Directory.systemTemp.path}/tazascan-photo-search-test.jpg',
  );
  await file.writeAsBytes([1, 2, 3], flush: true);
  return XFile(file.path);
}
