import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/history/data/datasources/history_local_data_source.dart';
import 'package:project/src/features/history/data/repositories/local_history_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../test_product_factory.dart';

Future<LocalHistoryRepository> createRepository({
  DateTime? now,
  Map<String, Object> initialValues = const {},
}) async {
  SharedPreferences.setMockInitialValues(initialValues);
  final preferences = await SharedPreferences.getInstance();

  return LocalHistoryRepository(
    HistoryLocalDataSource(preferences),
    now == null ? null : () => now,
  );
}

void main() {
  test('saves scan history', () async {
    final repository = await createRepository();

    await repository.saveViewedProduct(createTestProduct());

    final entries = await repository.list();
    expect(entries, hasLength(1));
    expect(entries.first.product.name, 'Coca-Cola Original Taste');
  });

  test('prevents duplicate consecutive scans', () async {
    final repository = await createRepository();
    final product = createTestProduct();

    await repository.saveViewedProduct(product);
    await repository.saveViewedProduct(product);

    expect(await repository.list(), hasLength(1));
  });

  test('limits history to latest 100 entries', () async {
    final repository = await createRepository();

    for (var index = 0; index < 105; index++) {
      await repository.saveViewedProduct(
        createTestProduct(id: 'id-$index', barcode: '5449000000$index'),
      );
    }

    final entries = await repository.list();
    expect(entries, hasLength(100));
    expect(entries.first.product.id, 'id-104');
  });

  test('deletes one history entry', () async {
    final repository = await createRepository();

    await repository.saveViewedProduct(createTestProduct(id: 'first'));
    await repository.saveViewedProduct(createTestProduct(id: 'second'));

    final entries = await repository.list();
    await repository.delete(entries.first.product.id, entries.first.viewedAt);

    final updated = await repository.list();
    expect(updated, hasLength(1));
    expect(updated.first.product.id, 'first');
  });

  test('clears history', () async {
    final repository = await createRepository();

    await repository.saveViewedProduct(createTestProduct());
    await repository.clear();

    expect(await repository.list(), isEmpty);
  });

  test('recovers safely from corrupted local data', () async {
    final repository = await createRepository(
      initialValues: {HistoryLocalDataSource.storageKey: 'not-json'},
    );

    expect(await repository.list(), isEmpty);
  });
}
