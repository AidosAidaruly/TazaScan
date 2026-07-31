import 'package:project/src/core/network/api_client.dart';
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
}
