import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/repositories/product_repository.dart';

class ProductService {
  const ProductService(this._productRepository);

  final ProductRepository _productRepository;

  Future<Product> findByBarcode(String barcode) {
    return _productRepository.findByBarcode(barcode);
  }
}
