import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/config/api_config.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/network/api_response.dart';
import 'package:project/src/features/product_submission/data/models/submission_ocr_candidate_model.dart';
import 'package:project/src/features/product_submission/domain/entities/product_submission_draft.dart';
import 'package:project/src/features/product_submission/domain/entities/submission_ocr_candidate.dart';
import 'package:project/src/features/product_submission/domain/repositories/product_submission_repository.dart';

// Error pages with invalid UTF-8 must still reach the status check.
const _lenientUtf8 = Utf8Codec(allowMalformed: true);

class HttpProductSubmissionRepository implements ProductSubmissionRepository {
  const HttpProductSubmissionRepository([this._httpClient]);

  final http.Client? _httpClient;

  @override
  Future<NutritionOcrCandidate> recognizeNutrition(XFile image) async {
    final json = await _uploadImageForJson(
      '/product-submissions/ocr/nutrition',
      image,
      timeout: const Duration(seconds: 30),
    );

    return _parseOcr(() => NutritionOcrCandidateModel.fromJson(json));
  }

  @override
  Future<IngredientsOcrCandidate> recognizeIngredients(XFile image) async {
    final json = await _uploadImageForJson(
      '/product-submissions/ocr/ingredients',
      image,
      timeout: const Duration(seconds: 30),
    );

    return _parseOcr(() => IngredientsOcrCandidateModel.fromJson(json));
  }

  @override
  Future<void> submit(ProductSubmissionDraft draft) async {
    final client = _httpClient ?? http.Client();

    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiConfig.baseUrl}/product-submissions'),
      );
      request.headers[HttpHeaders.acceptHeader] = 'application/json';
      request.fields.addAll(_fieldsFromDraft(draft));
      await _addFile(request, 'frontImage', draft.frontImage?.path);
      await _addFile(request, 'ingredientsImage', draft.ingredientsImage?.path);
      await _addFile(request, 'nutritionImage', draft.nutritionImage?.path);
      await _addFile(request, 'barcodeImage', draft.barcodeImage?.path);

      final response = await client
          .send(request)
          .timeout(const Duration(seconds: 45));
      final body = await response.stream.bytesToString(_lenientUtf8);
      decodeApiResponse(
        response.statusCode,
        body,
        requestFailedMessage:
            'Отправка не удалась. Проверь форму и попробуй снова.',
      );
    } on TimeoutException {
      throw const RequestTimeoutException(
        'Отправка заняла слишком много времени. Попробуй снова.',
      );
    } on SocketException {
      throw const NetworkException('Нет подключения к интернету.');
    } on http.ClientException {
      throw const NetworkException('Нет подключения к интернету.');
    } on AppException {
      rethrow;
    } catch (_) {
      throw const UnknownAppException('Не удалось отправить продукт.');
    } finally {
      if (_httpClient == null) {
        client.close();
      }
    }
  }

  Future<Map<String, dynamic>> _uploadImageForJson(
    String path,
    XFile image, {
    required Duration timeout,
  }) async {
    final client = _httpClient ?? http.Client();

    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiConfig.baseUrl}$path'),
      );
      request.headers[HttpHeaders.acceptHeader] = 'application/json';
      request.files.add(await http.MultipartFile.fromPath('image', image.path));

      final response = await client.send(request).timeout(timeout);
      final body = await response.stream.bytesToString(_lenientUtf8);

      return decodeApiResponse(
        response.statusCode,
        body,
        endpoint: ApiEndpoint.ocr,
        requestFailedMessage:
            'Не удалось распознать данные. Можно заполнить поля вручную или сделать другое фото.',
      );
    } on TimeoutException {
      throw const RequestTimeoutException(
        'Распознавание заняло слишком много времени. Можно заполнить поля вручную или попробовать другое фото.',
      );
    } on SocketException {
      throw const NetworkException('Нет подключения к интернету.');
    } on http.ClientException {
      throw const NetworkException('Нет подключения к интернету.');
    } on AppException {
      rethrow;
    } catch (_) {
      throw const UnknownAppException(
        'Не удалось распознать данные. Можно заполнить поля вручную или сделать другое фото.',
      );
    } finally {
      if (_httpClient == null) {
        client.close();
      }
    }
  }

  Map<String, String> _fieldsFromDraft(ProductSubmissionDraft draft) {
    return {
      if (draft.barcode.trim().isNotEmpty) 'barcode': draft.barcode.trim(),
      if (draft.name.trim().isNotEmpty) 'name': draft.name.trim(),
      if (draft.brand.trim().isNotEmpty) 'brand': draft.brand.trim(),
      if (draft.category.trim().isNotEmpty) 'category': draft.category.trim(),
      if (draft.ingredients.trim().isNotEmpty)
        'ingredients': draft.ingredients.trim(),
      'servingType': draft.servingType,
      ..._optionalNumberFields(draft),
    };
  }

  Map<String, String> _optionalNumberFields(ProductSubmissionDraft draft) {
    final fields = {
      'energyKcal': draft.energyKcal,
      'protein': draft.protein,
      'carbohydrates': draft.carbohydrates,
      'sugars': draft.sugars,
      'fat': draft.fat,
      'saturatedFat': draft.saturatedFat,
      'fiber': draft.fiber,
      'salt': draft.salt,
    };

    return Map.fromEntries(
      fields.entries.where((entry) => entry.value.trim().isNotEmpty),
    );
  }

  Future<void> _addFile(
    http.MultipartRequest request,
    String field,
    String? path,
  ) async {
    if (path == null) {
      return;
    }

    request.files.add(await http.MultipartFile.fromPath(field, path));
  }

  // A 2xx body with an unexpected shape is an invalid response, never a raw TypeError.
  T _parseOcr<T>(T Function() parse) {
    try {
      return parse();
    } on Object {
      throw const InvalidResponseException(
        'Не удалось прочитать результат распознавания.',
      );
    }
  }
}
