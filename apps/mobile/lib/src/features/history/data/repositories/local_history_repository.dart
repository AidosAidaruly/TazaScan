import 'package:project/src/features/history/data/datasources/history_local_data_source.dart';
import 'package:project/src/features/history/data/models/history_entry_model.dart';
import 'package:project/src/features/history/domain/entities/history_entry.dart';
import 'package:project/src/features/history/domain/repositories/history_repository.dart';
import 'package:project/src/features/product/data/models/cached_product_summary_model.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class LocalHistoryRepository implements HistoryRepository {
  const LocalHistoryRepository(this._dataSource, [this._clock]);

  static const maxEntries = 100;

  final HistoryLocalDataSource _dataSource;
  final DateTime Function()? _clock;

  @override
  Future<List<HistoryEntry>> list() async {
    return _dataSource.readEntries();
  }

  @override
  Future<void> saveViewedProduct(Product product) async {
    final entries = _dataSource.readEntries().toList();
    final summary = CachedProductSummaryModel.fromProduct(product);
    final now = (_clock ?? DateTime.now).call();

    if (entries.isNotEmpty && entries.first.product.id == product.id) {
      entries[0] = HistoryEntryModel(product: summary, viewedAt: now);
    } else {
      entries.insert(0, HistoryEntryModel(product: summary, viewedAt: now));
    }

    await _dataSource.writeEntries(entries.take(maxEntries).toList());
  }

  @override
  Future<void> delete(String productId, DateTime viewedAt) async {
    final entries = _dataSource
        .readEntries()
        .where(
          (entry) =>
              entry.product.id != productId ||
              entry.viewedAt.toIso8601String() != viewedAt.toIso8601String(),
        )
        .toList();

    await _dataSource.writeEntries(entries);
  }

  @override
  Future<void> clear() {
    return _dataSource.clear();
  }
}
