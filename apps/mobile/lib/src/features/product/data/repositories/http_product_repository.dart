import 'package:flutter/foundation.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/network/api_client.dart';
import 'package:project/src/core/network/paginated_response.dart';
import 'package:project/src/features/product/data/models/product_model.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
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
