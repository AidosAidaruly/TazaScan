import 'package:flutter/foundation.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/network/api_client.dart';
import 'package:project/src/core/network/paginated_response.dart';
import 'package:project/src/features/product/data/models/product_model.dart';
import 'package:project/src/features/product/data/models/product_score_preview_model.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/domain/repositories/product_repository.dart';

class HttpProductRepository implements ProductRepository {
  const HttpProductRepository(this._apiClient);

  final ApiClient _apiClient;

  @override
  Future<Product> findByBarcode(String barcode) async {
    final response = await _apiClient.getJson('/products/barcode/$barcode');
    final data = response['data'] as Map<String, dynamic>;

    return ProductModel.fromJson(data);
  }

  @override
  Future<TazaScorePreviewData> previewScore(String productId) async {
    final response = await _apiClient.getJson(
      '/products/$productId/score-preview',
    );

    try {
      final data = response['data'];
      if (data is! Map<String, dynamic>) {
        throw const FormatException('Expected score preview data object.');
      }

      return ProductScorePreviewModel.fromJson(data).tazaScore;
    } on FormatException catch (error) {
      _debugLog(
        'GET /products/$productId/score-preview parseException=${error.runtimeType}',
      );
      throw const InvalidResponseException(
        'Не удалось прочитать новую оценку.',
      );
    } on TypeError catch (error) {
      _debugLog(
        'GET /products/$productId/score-preview parseException=${error.runtimeType}',
      );
      throw const InvalidResponseException(
        'Не удалось прочитать новую оценку.',
      );
    }
  }

  @override
  Future<List<Product>> search({
    String? name,
    String? brand,
    String? barcode,
    int pageSize = 20,
  }) async {
    final response = await _apiClient.getJson(
      '/products',
      queryParameters: {
        'page': '1',
        'pageSize': pageSize.toString(),
        if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
        if (brand != null && brand.trim().isNotEmpty) 'brand': brand.trim(),
        if (barcode != null && barcode.trim().isNotEmpty)
          'barcode': barcode.trim(),
      },
    );
    try {
      final products = PaginatedResponse<Product>.fromJson(
        response,
        ProductModel.fromJson,
      ).data;

      _debugLog('GET /products parsedItemCount=${products.length}');

      return products;
    } on FormatException catch (error) {
      _debugLog('GET /products parseException=${error.runtimeType}');
      throw const InvalidResponseException(
        'Не удалось прочитать список продуктов.',
      );
    } on TypeError catch (error) {
      _debugLog('GET /products parseException=${error.runtimeType}');
      throw const InvalidResponseException(
        'Не удалось прочитать список продуктов.',
      );
    }
  }

  void _debugLog(String message) {
    if (kDebugMode) {
      debugPrint('[HttpProductRepository] $message');
    }
  }
}
