import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';

abstract interface class ProductRepository {
  Future<Product> findByBarcode(String barcode);

  Future<TazaScorePreviewData> previewScore(String productId);

  Future<List<Product>> search({
    String? name,
    String? brand,
    String? barcode,
    int pageSize = 20,
  });
}
