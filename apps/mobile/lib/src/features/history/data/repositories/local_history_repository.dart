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

  /// Records a view. This is a background side effect of opening a product, so when
  /// unreadable stored history cannot be backed up, the view is skipped (the stored
  /// history stays untouched and the backup is retried next time) instead of throwing.
  @override
  Future<void> saveViewedProduct(Product product) async {
    final summary = CachedProductSummaryModel.fromProduct(product);
    final now = (_clock ?? DateTime.now).call();

    try {
      await _dataSource.updateEntries((current) {
        // Older views of the same product show the latest known product data, so a
        // network refresh never leaves the history inconsistent. Their view times stay.
        final entries = current
            .map(
              (entry) => entry.product.id == product.id
                  ? HistoryEntryModel(
                      product: summary,
                      viewedAt: entry.viewedAt,
                    )
                  : entry,
            )
            .toList();

        if (entries.isNotEmpty && entries.first.product.id == product.id) {
          entries[0] = HistoryEntryModel(product: summary, viewedAt: now);
        } else {
          entries.insert(0, HistoryEntryModel(product: summary, viewedAt: now));
        }

        return entries.take(maxEntries).toList();
      });
    } on HistoryBackupException {
      // Nothing was written; the unreadable original history is kept as it was.
    }
  }

  @override
  Future<void> delete(String productId, DateTime viewedAt) {
    return _dataSource.updateEntries(
      (current) => current
          .where(
            (entry) =>
                entry.product.id != productId ||
                entry.viewedAt.toIso8601String() != viewedAt.toIso8601String(),
          )
          .toList(),
    );
  }

  @override
  Future<void> clear() {
    return _dataSource.clear();
  }
}
