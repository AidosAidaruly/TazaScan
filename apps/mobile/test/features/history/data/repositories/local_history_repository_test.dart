import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/history/data/models/history_entry_model.dart';
import 'package:project/src/features/history/data/datasources/history_local_data_source.dart';
import 'package:project/src/features/history/data/repositories/local_history_repository.dart';
import 'package:project/src/features/product/data/models/cached_product_summary_model.dart';
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

  group('corrupted local history', () {
    Map<String, dynamic> validEntry(
      String id,
      DateTime viewedAt, {
      String? name,
    }) {
      return HistoryEntryModel(
        product: CachedProductSummaryModel.fromProduct(
          createTestProduct(id: id, name: name ?? 'Product $id'),
        ),
        viewedAt: viewedAt,
      ).toJson();
    }

    final t1 = DateTime.utc(2026, 8, 3, 12);
    final t2 = DateTime.utc(2026, 8, 2, 12);
    final t3 = DateTime.utc(2026, 8, 1, 12);

    Future<LocalHistoryRepository> withStored(
      List<Object?> items, {
      DateTime? now,
    }) {
      return createRepository(
        now: now,
        initialValues: {HistoryLocalDataSource.storageKey: jsonEncode(items)},
      );
    }

    test('one corrupt entry does not remove the valid ones', () async {
      final repository = await withStored([
        validEntry('a', t1),
        {'product': 'not-a-map', 'viewedAt': t2.toIso8601String()},
        validEntry('c', t3),
      ]);

      final entries = await repository.list();

      expect(entries.map((entry) => entry.product.id), ['a', 'c']);
    });

    test(
      'multiple corrupt entries of different shapes are skipped safely',
      () async {
        final repository = await withStored([
          'just a string',
          42,
          null,
          validEntry('a', t1),
          {'product': validEntry('x', t1)['product'], 'viewedAt': 'not-a-date'},
          {'viewedAt': t2.toIso8601String()},
          <Object?>[],
          validEntry('b', t2),
        ]);

        expect((await repository.list()).map((entry) => entry.product.id), [
          'a',
          'b',
        ]);
      },
    );

    test('all-valid history loads unchanged, in stored order', () async {
      final stored = [
        validEntry('a', t1),
        validEntry('b', t2),
        validEntry('a', t3),
      ];
      final repository = await withStored(stored);

      final entries = await repository.list();

      expect(entries.map((entry) => entry.product.id), ['a', 'b', 'a']);
      expect(entries.map((entry) => entry.viewedAt), [t1, t2, t3]);
      expect(
        entries
            .map((entry) => HistoryEntryModel.fromEntity(entry).toJson())
            .toList(),
        stored,
      );
    });

    test(
      'saving keeps valid entries and backs up the unreadable raw data once',
      () async {
        final repository = await withStored([
          validEntry('a', t2),
          {'broken': true},
          validEntry('b', t3),
        ], now: t1);
        final preferences = await SharedPreferences.getInstance();
        final rawBefore = preferences.getString(
          HistoryLocalDataSource.storageKey,
        );

        await repository.saveViewedProduct(createTestProduct(id: 'new'));

        expect((await repository.list()).map((entry) => entry.product.id), [
          'new',
          'a',
          'b',
        ]);
        expect(
          preferences.getString(HistoryLocalDataSource.corruptBackupKey),
          rawBefore,
        );
      },
    );

    test(
      'an unreadable history blob is backed up before the next write, not silently lost',
      () async {
        final repository = await createRepository(
          initialValues: {HistoryLocalDataSource.storageKey: '{not json'},
        );
        final preferences = await SharedPreferences.getInstance();

        expect(await repository.list(), isEmpty);
        await repository.saveViewedProduct(createTestProduct());

        expect(await repository.list(), hasLength(1));
        expect(
          preferences.getString(HistoryLocalDataSource.corruptBackupKey),
          '{not json',
        );
      },
    );

    test(
      'exact duplicate entries are dropped and saving does not add duplicates',
      () async {
        final repository = await withStored([
          validEntry('a', t1),
          validEntry('a', t1),
          validEntry('b', t2),
        ], now: DateTime.utc(2026, 8, 4));

        expect((await repository.list()).map((entry) => entry.product.id), [
          'a',
          'b',
        ]);

        await repository.saveViewedProduct(createTestProduct(id: 'a'));
        await repository.saveViewedProduct(createTestProduct(id: 'a'));

        expect((await repository.list()).map((entry) => entry.product.id), [
          'a',
          'b',
        ]);
      },
    );

    test(
      'a refreshed product updates its older entries without reordering them',
      () async {
        final repository = await withStored([
          validEntry('b', t1),
          validEntry('a', t2, name: 'Old name'),
        ], now: DateTime.utc(2026, 8, 4));

        await repository.saveViewedProduct(
          createTestProduct(id: 'a', name: 'Fresh name'),
        );

        final entries = await repository.list();
        expect(entries.map((entry) => entry.product.id), ['a', 'b', 'a']);
        expect(entries.map((entry) => entry.viewedAt).skip(1), [t1, t2]);
        expect(
          entries
              .where((entry) => entry.product.id == 'a')
              .map((entry) => entry.product.name),
          ['Fresh name', 'Fresh name'],
        );
      },
    );

    test('concurrent saves do not lose either update', () async {
      final repository = await createRepository();

      await Future.wait([
        repository.saveViewedProduct(createTestProduct(id: 'first')),
        repository.saveViewedProduct(createTestProduct(id: 'second')),
      ]);

      expect(
        (await repository.list()).map((entry) => entry.product.id).toSet(),
        {'first', 'second'},
      );
    });

    test('delete and clear still work with corrupt data present', () async {
      final repository = await withStored([
        validEntry('a', t1),
        'garbage',
        validEntry('b', t2),
      ]);
      final preferences = await SharedPreferences.getInstance();

      await repository.delete('a', t1);
      expect((await repository.list()).map((entry) => entry.product.id), ['b']);
      expect(
        preferences.getString(HistoryLocalDataSource.corruptBackupKey),
        isNotNull,
      );

      await repository.clear();
      expect(await repository.list(), isEmpty);
      expect(
        preferences.getString(HistoryLocalDataSource.corruptBackupKey),
        isNull,
      );
    });
  });

  group('backup write failures', () {
    const historyKey = HistoryLocalDataSource.storageKey;
    const backupKey = HistoryLocalDataSource.corruptBackupKey;

    final t1 = DateTime.utc(2026, 8, 3, 12);
    final t2 = DateTime.utc(2026, 8, 2, 12);
    final t3 = DateTime.utc(2026, 8, 1, 12);
    final now = DateTime.utc(2026, 8, 4, 12);

    Map<String, dynamic> validEntry(String id, DateTime viewedAt) {
      return HistoryEntryModel(
        product: CachedProductSummaryModel.fromProduct(
          createTestProduct(id: id, name: 'Product $id'),
        ),
        viewedAt: viewedAt,
      ).toJson();
    }

    final corruptRaw = jsonEncode([
      validEntry('a', t2),
      {'broken': true},
      validEntry('b', t3),
    ]);

    /// Models what survives an app restart: only writes the platform reported as
    /// successful. Like SharedPreferences, the in-memory cache is always updated first.
    late Map<String, String> disk;
    late SharedPreferences preferences;

    Future<void> seed(String raw) async {
      SharedPreferences.setMockInitialValues({historyKey: raw});
      preferences = await SharedPreferences.getInstance();
      disk = {historyKey: raw};
    }

    setUp(() => seed(corruptRaw));

    HistoryPreferenceWriter writer({
      Future<bool> Function(String key, String value)? backup,
    }) {
      return (key, value) async {
        await preferences.setString(key, value);
        if (key == backupKey && backup != null) {
          return backup(key, value);
        }
        disk[key] = value;
        return true;
      };
    }

    LocalHistoryRepository repositoryWith(HistoryPreferenceWriter write) {
      return LocalHistoryRepository(
        HistoryLocalDataSource(preferences, writeString: write),
        () => now,
      );
    }

    List<Object?> diskIds() {
      return (jsonDecode(disk[historyKey]!) as List)
          .map(
            (entry) => entry is Map && entry['product'] is Map
                ? (entry['product'] as Map)['id']
                : '<broken>',
          )
          .toList();
    }

    for (final (label, failingBackup)
        in <(String, Future<bool> Function(String, String))>[
          ('reports false', (_, _) async => false),
          ('throws', (_, _) async => throw StateError('disk full')),
        ]) {
      test(
        'saving a view when the backup write $label records nothing and keeps the original',
        () async {
          final repository = repositoryWith(writer(backup: failingBackup));

          // Recording a view is a side effect of opening a product: it must not throw.
          await repository.saveViewedProduct(createTestProduct(id: 'new'));

          expect(disk[historyKey], corruptRaw);
          expect(disk.containsKey(backupKey), isFalse);
          // The failed backup must not look like it exists, or the next write would skip it.
          expect(preferences.containsKey(backupKey), isFalse);
          expect(preferences.getString(historyKey), corruptRaw);
          expect((await repository.list()).map((entry) => entry.product.id), [
            'a',
            'b',
          ]);
        },
      );

      test(
        'deleting when the backup write $label throws and keeps the original',
        () async {
          final repository = repositoryWith(writer(backup: failingBackup));

          await expectLater(
            repository.delete('a', t2),
            throwsA(isA<HistoryBackupException>()),
          );

          expect(disk[historyKey], corruptRaw);
          expect(preferences.containsKey(backupKey), isFalse);
          expect((await repository.list()).map((entry) => entry.product.id), [
            'a',
            'b',
          ]);
        },
      );
    }

    test(
      'after a failed backup, the next save backs up first and then records',
      () async {
        await repositoryWith(
          writer(backup: (_, _) async => false),
        ).saveViewedProduct(createTestProduct(id: 'skipped'));

        final working = writer(
          backup: (key, value) async {
            disk[key] = value;
            return true;
          },
        );
        await repositoryWith(
          working,
        ).saveViewedProduct(createTestProduct(id: 'new'));

        expect(disk[backupKey], corruptRaw);
        expect(diskIds(), ['new', 'a', 'b']);
      },
    );

    test(
      'concurrent saves while a slow backup is in flight keep both views',
      () async {
        final backupGate = Completer<void>();
        final repository = repositoryWith(
          writer(
            backup: (key, value) async {
              await backupGate.future;
              disk[key] = value;
              return true;
            },
          ),
        );

        final first = repository.saveViewedProduct(createTestProduct(id: 'x'));
        final second = repository.saveViewedProduct(createTestProduct(id: 'y'));
        backupGate.complete();
        await Future.wait([first, second]);

        expect(
          (await repository.list()).map((entry) => entry.product.id).toSet(),
          {'x', 'y', 'a', 'b'},
        );
        expect(diskIds().toSet(), {'x', 'y', 'a', 'b'});
        expect(disk[backupKey], corruptRaw);
      },
    );

    test(
      'clear issued while a save waits on a slow backup leaves history empty',
      () async {
        final backupGate = Completer<void>();
        final repository = repositoryWith(
          writer(
            backup: (key, value) async {
              await backupGate.future;
              disk[key] = value;
              return true;
            },
          ),
        );

        final save = repository.saveViewedProduct(createTestProduct(id: 'x'));
        final clear = repository.clear();
        backupGate.complete();
        await Future.wait([save, clear]);

        expect(await repository.list(), isEmpty);
        expect(preferences.containsKey(historyKey), isFalse);
        expect(preferences.containsKey(backupKey), isFalse);
      },
    );

    test(
      'concurrent save and delete on readable history keep both changes',
      () async {
        await seed(jsonEncode([validEntry('a', t1), validEntry('b', t2)]));
        final repository = LocalHistoryRepository(
          HistoryLocalDataSource(preferences),
          () => now,
        );

        await Future.wait([
          repository.saveViewedProduct(createTestProduct(id: 'c')),
          repository.delete('a', t1),
        ]);

        expect((await repository.list()).map((entry) => entry.product.id), [
          'c',
          'b',
        ]);
      },
    );

    test(
      'the 100-entry limit and duplicate rules still hold with corrupt data present',
      () async {
        final stored = <Object?>[
          for (var index = 0; index < 100; index++)
            validEntry('v$index', t1.subtract(Duration(minutes: index))),
          {'broken': true},
        ];
        await seed(jsonEncode(stored));
        final repository = repositoryWith(writer());

        await repository.saveViewedProduct(createTestProduct(id: 'new'));
        await repository.saveViewedProduct(createTestProduct(id: 'new'));

        final ids = (await repository.list())
            .map((entry) => entry.product.id)
            .toList();
        expect(ids, hasLength(100));
        expect(ids.first, 'new');
        expect(ids.where((id) => id == 'new'), hasLength(1));
        expect(ids.last, 'v98');
        expect(disk[backupKey], jsonEncode(stored));
      },
    );

    test(
      'recovered history and its backup persist after an app restart',
      () async {
        await repositoryWith(
          writer(),
        ).saveViewedProduct(createTestProduct(id: 'new'));

        // Restart: a fresh cache loaded only from what reached the disk.
        SharedPreferences.setMockInitialValues(Map<String, Object>.from(disk));
        final restarted = LocalHistoryRepository(
          HistoryLocalDataSource(await SharedPreferences.getInstance()),
          () => now,
        );

        expect((await restarted.list()).map((entry) => entry.product.id), [
          'new',
          'a',
          'b',
        ]);
        expect(disk[backupKey], corruptRaw);
      },
    );
  });
}
