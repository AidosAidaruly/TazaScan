import 'package:project/src/features/product/domain/entities/product.dart';

abstract interface class ProductRepository {
  Future<Product> findByBarcode(String barcode);
}
