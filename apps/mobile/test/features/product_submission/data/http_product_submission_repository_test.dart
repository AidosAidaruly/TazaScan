import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/features/product_submission/data/repositories/http_product_submission_repository.dart';

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
}

Future<XFile> _temporaryImage() async {
  final file = File('${Directory.systemTemp.path}/tazascan-submission-test.jpg');
  await file.writeAsBytes([1, 2, 3], flush: true);
  return XFile(file.path);
}
