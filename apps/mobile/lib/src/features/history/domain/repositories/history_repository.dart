import 'package:project/src/features/history/domain/entities/history_entry.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

abstract interface class HistoryRepository {
  Future<List<HistoryEntry>> list();
  Future<void> saveViewedProduct(Product product);
  Future<void> delete(String productId, DateTime viewedAt);
  Future<void> clear();
}
