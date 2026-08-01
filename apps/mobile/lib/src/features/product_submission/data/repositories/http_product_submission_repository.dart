import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:project/src/core/config/api_config.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/features/product_submission/domain/entities/product_submission_draft.dart';
import 'package:project/src/features/product_submission/domain/repositories/product_submission_repository.dart';

class HttpProductSubmissionRepository implements ProductSubmissionRepository {
  const HttpProductSubmissionRepository([this._httpClient]);

  final http.Client? _httpClient;

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

      final response = await client.send(request).timeout(
        const Duration(seconds: 45),
      );
      final body = await response.stream.bytesToString();
      _handleResponse(response.statusCode, body);
    } on TimeoutException {
      throw const RequestTimeoutException('Submission took too long. Try again.');
    } on SocketException {
      throw const NetworkException('No internet connection.');
    } on AppException {
      rethrow;
    } catch (_) {
      throw const UnknownAppException('Could not submit product.');
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
      if (draft.ingredients.trim().isNotEmpty) 'ingredients': draft.ingredients.trim(),
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

  void _handleResponse(int statusCode, String body) {
    final json = body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(body) as Map<String, dynamic>;

    if (statusCode >= 500) {
      throw const ServerException('Server is unavailable. Try again later.');
    }

    if (statusCode < 200 || statusCode >= 300) {
      throw ServerException(_readErrorMessage(json));
    }
  }

  String _readErrorMessage(Map<String, dynamic> json) {
    final error = json['error'];
    if (error is Map<String, dynamic> && error['message'] is String) {
      return error['message'] as String;
    }

    return 'Submission failed. Check the form and try again.';
  }
}
