import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

abstract interface class FavoritesRepository {
  Future<List<CachedProductSummary>> list();
  Future<bool> isFavorite(String productId);
  Future<void> add(Product product);
  Future<void> remove(String productId);
}
