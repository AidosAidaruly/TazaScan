import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/config/api_config.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/network/api_response.dart';
import 'package:project/src/features/photo_search/data/models/photo_search_result_model.dart';
import 'package:project/src/features/photo_search/domain/entities/photo_search_result.dart';
import 'package:project/src/features/photo_search/domain/repositories/photo_search_repository.dart';

// Error pages with invalid UTF-8 must still reach the status check.
const _lenientUtf8 = Utf8Codec(allowMalformed: true);

class HttpPhotoSearchRepository implements PhotoSearchRepository {
  const HttpPhotoSearchRepository([this._httpClient]);

  final http.Client? _httpClient;

  @override
  Future<PhotoSearchResult> searchByImage(XFile image) async {
    final client = _httpClient ?? http.Client();

    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiConfig.baseUrl}/products/photo-search'),
      );

      request.headers[HttpHeaders.acceptHeader] = 'application/json';
      request.files.add(await http.MultipartFile.fromPath('image', image.path));

      final streamedResponse = await client
          .send(request)
          .timeout(const Duration(seconds: 35));
      final body = await streamedResponse.stream.bytesToString(_lenientUtf8);

      return _handleResponse(streamedResponse.statusCode, body);
    } on TimeoutException {
      throw const RequestTimeoutException(
        'Поиск по фото занял слишком много времени. Попробуй другое фото.',
      );
    } on SocketException {
      throw const NetworkException('Нет подключения к интернету.');
    } on http.ClientException {
      throw const NetworkException('Нет подключения к интернету.');
    } on AppException {
      rethrow;
    } catch (_) {
      throw const UnknownAppException('Не удалось выполнить поиск по фото.');
    } finally {
      if (_httpClient == null) {
        client.close();
      }
    }
  }

  PhotoSearchResult _handleResponse(int statusCode, String body) {
    final json = decodeApiResponse(
      statusCode,
      body,
      endpoint: ApiEndpoint.ocr,
      unsupportedMediaMessage:
          'Не удалось открыть изображение. Попробуйте выбрать другое фото.',
      requestFailedMessage: 'Поиск по фото не удался. Попробуй другое фото.',
    );

    try {
      return PhotoSearchResultModel.fromJson(json);
    } on Object {
      throw const InvalidResponseException(
        'Не удалось прочитать ответ сервера.',
      );
    }
  }
}
