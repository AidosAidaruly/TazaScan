import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';

class HistoryEntry {
  const HistoryEntry({required this.product, required this.viewedAt});

  final CachedProductSummary product;
  final DateTime viewedAt;
}
