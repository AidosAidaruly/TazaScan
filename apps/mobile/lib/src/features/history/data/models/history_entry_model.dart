import 'package:project/src/features/history/domain/entities/history_entry.dart';
import 'package:project/src/features/product/data/models/cached_product_summary_model.dart';

class HistoryEntryModel extends HistoryEntry {
  const HistoryEntryModel({
    required super.product,
    required super.viewedAt,
  });

  factory HistoryEntryModel.fromEntity(HistoryEntry entry) {
    return HistoryEntryModel(product: entry.product, viewedAt: entry.viewedAt);
  }

  factory HistoryEntryModel.fromJson(Map<String, dynamic> json) {
    return HistoryEntryModel(
      product: CachedProductSummaryModel.fromJson(
        Map<String, dynamic>.from(json['product'] as Map),
      ),
      viewedAt: DateTime.parse(json['viewedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product': CachedProductSummaryModel.fromEntity(product).toJson(),
      'viewedAt': viewedAt.toIso8601String(),
    };
  }
}
