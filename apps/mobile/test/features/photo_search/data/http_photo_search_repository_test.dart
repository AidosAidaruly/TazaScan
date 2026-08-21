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
}

Future<XFile> _temporaryImage() async {
  final file = File(
    '${Directory.systemTemp.path}/tazascan-photo-search-test.jpg',
  );
  await file.writeAsBytes([1, 2, 3], flush: true);
  return XFile(file.path);
}
