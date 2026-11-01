import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/favorites/data/datasources/favorites_local_data_source.dart';
import 'package:project/src/features/favorites/data/repositories/local_favorites_repository.dart';
import 'package:project/src/features/product/data/models/cached_product_summary_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../test_product_factory.dart';

Future<LocalFavoritesRepository> createRepository({
  Map<String, Object> initialValues = const {},
}) async {
  SharedPreferences.setMockInitialValues(initialValues);
  final preferences = await SharedPreferences.getInstance();

  return LocalFavoritesRepository(FavoritesLocalDataSource(preferences));
}

void main() {
  test('adds favorite', () async {
    final repository = await createRepository();

    await repository.add(createTestProduct());

    final products = await repository.list();
    expect(products, hasLength(1));
    expect(await repository.isFavorite('product-id'), isTrue);
  });

  test('prevents duplicate favorites', () async {
    final repository = await createRepository();
    final product = createTestProduct();

    await repository.add(product);
    await repository.add(product);

    expect(await repository.list(), hasLength(1));
  });

  test('removes favorite', () async {
    final repository = await createRepository();

    await repository.add(createTestProduct());
    await repository.remove('product-id');

    expect(await repository.list(), isEmpty);
  });

  test('persists after app restart', () async {
    final repository = await createRepository();
    await repository.add(createTestProduct());

    final preferences = await SharedPreferences.getInstance();
    final restarted = LocalFavoritesRepository(
      FavoritesLocalDataSource(preferences),
    );

    expect(await restarted.isFavorite('product-id'), isTrue);
  });

  test('cached favorite can display offline product details', () async {
    final repository = await createRepository();
    await repository.add(createTestProduct());

    final cachedProduct = (await repository.list()).first.toCachedProduct();

    expect(cachedProduct.name, 'Coca-Cola Original Taste');
    expect(cachedProduct.nutritionScore.status, 'offline_cached');
  });

  group('corrupted local favorites', () {
    Map<String, dynamic> validEntry(String id) {
      return CachedProductSummaryModel.fromProduct(
        createTestProduct(id: id, name: 'Product $id'),
      ).toJson();
    }

    Future<LocalFavoritesRepository> withStored(List<Object?> items) {
      return createRepository(
        initialValues: {FavoritesLocalDataSource.storageKey: jsonEncode(items)},
      );
    }

    Future<List<String>> ids(LocalFavoritesRepository repository) async {
      return (await repository.list()).map((product) => product.id).toList();
    }

    test(
      'one corrupt entry among valid favorites does not hide the valid ones',
      () async {
        final repository = await withStored([
          validEntry('a'),
          {'id': 'broken', 'name': 'missing barcode, score and dates'},
          validEntry('c'),
        ]);

        expect(await ids(repository), ['a', 'c']);
        expect(await repository.isFavorite('a'), isTrue);
        expect(await repository.isFavorite('broken'), isFalse);
      },
    );

    test('malformed entries of different shapes are skipped safely', () async {
      final repository = await withStored([
        'just a string',
        42,
        null,
        <Object?>[],
        validEntry('a'),
        {...validEntry('x'), 'calculatedScore': 'not-a-number'},
        {...validEntry('y'), 'createdAt': 'not-a-date'},
        {...validEntry('z'), 'id': null},
        validEntry('b'),
      ]);

      expect(await ids(repository), ['a', 'b']);
    });

    test('all-valid favorites load unchanged, in stored order', () async {
      final stored = [validEntry('a'), validEntry('b'), validEntry('c')];
      final repository = await withStored(stored);

      final products = await repository.list();

      expect(products.map((product) => product.id), ['a', 'b', 'c']);
      expect(
        products
            .map(
              (product) =>
                  CachedProductSummaryModel.fromEntity(product).toJson(),
            )
            .toList(),
        stored,
      );
    });

    test(
      'adding after corrupt data keeps every valid favorite and backs up the raw data',
      () async {
        final repository = await withStored([
          validEntry('a'),
          {'broken': true},
          validEntry('b'),
        ]);
        final preferences = await SharedPreferences.getInstance();
        final rawBefore = preferences.getString(
          FavoritesLocalDataSource.storageKey,
        );

        await repository.add(createTestProduct(id: 'new'));

        expect(await ids(repository), ['new', 'a', 'b']);
        expect(
          preferences.getString(FavoritesLocalDataSource.corruptBackupKey),
          rawBefore,
        );
      },
    );

    test('removing after corrupt data removes only that favorite', () async {
      final repository = await withStored([
        validEntry('a'),
        {'broken': true},
        validEntry('b'),
        validEntry('c'),
      ]);
      final preferences = await SharedPreferences.getInstance();
      final rawBefore = preferences.getString(
        FavoritesLocalDataSource.storageKey,
      );

      await repository.remove('b');

      expect(await ids(repository), ['a', 'c']);
      expect(
        preferences.getString(FavoritesLocalDataSource.corruptBackupKey),
        rawBefore,
      );
    });

    test(
      'the backup keeps the first unreadable value and is not overwritten later',
      () async {
        final repository = await withStored([
          validEntry('a'),
          {'broken': true},
        ]);
        final preferences = await SharedPreferences.getInstance();
        final firstRaw = preferences.getString(
          FavoritesLocalDataSource.storageKey,
        );

        await repository.add(createTestProduct(id: 'b'));
        await preferences.setString(
          FavoritesLocalDataSource.storageKey,
          jsonEncode([validEntry('a'), 'another broken entry']),
        );
        await repository.add(createTestProduct(id: 'c'));

        expect(await ids(repository), ['c', 'a']);
        expect(
          preferences.getString(FavoritesLocalDataSource.corruptBackupKey),
          firstRaw,
        );
      },
    );

    test(
      'a duplicate add is still ignored when corrupt data is present',
      () async {
        final repository = await withStored([
          validEntry('a'),
          {'broken': true},
        ]);
        final preferences = await SharedPreferences.getInstance();
        final rawBefore = preferences.getString(
          FavoritesLocalDataSource.storageKey,
        );

        await repository.add(createTestProduct(id: 'a'));

        expect(await ids(repository), ['a']);
        // Nothing was written, so the stored value (including the unreadable entry) is untouched.
        expect(
          preferences.getString(FavoritesLocalDataSource.storageKey),
          rawBefore,
        );
        expect(
          preferences.containsKey(FavoritesLocalDataSource.corruptBackupKey),
          isFalse,
        );
      },
    );

    test('empty storage reads as no favorites and writes no backup', () async {
      final repository = await createRepository();
      final preferences = await SharedPreferences.getInstance();

      expect(await repository.list(), isEmpty);
      await repository.add(createTestProduct(id: 'a'));

      expect(await ids(repository), ['a']);
      expect(
        preferences.containsKey(FavoritesLocalDataSource.corruptBackupKey),
        isFalse,
      );
    });

    for (final (label, raw) in [
      ('invalid JSON', '{not json'),
      ('a JSON object instead of a list', '{"id": "a"}'),
      ('a JSON string', '"favorites"'),
    ]) {
      test(
        'a completely unreadable blob ($label) is backed up before the next write',
        () async {
          final repository = await createRepository(
            initialValues: {FavoritesLocalDataSource.storageKey: raw},
          );
          final preferences = await SharedPreferences.getInstance();

          expect(await repository.list(), isEmpty);
          await repository.add(createTestProduct(id: 'a'));

          expect(await ids(repository), ['a']);
          expect(
            preferences.getString(FavoritesLocalDataSource.corruptBackupKey),
            raw,
          );
        },
      );
    }

    test('recovered favorites persist after an app restart', () async {
      final repository = await withStored([
        validEntry('a'),
        {'broken': true},
        validEntry('b'),
      ]);
      await repository.add(createTestProduct(id: 'new'));

      final preferences = await SharedPreferences.getInstance();
      final restarted = LocalFavoritesRepository(
        FavoritesLocalDataSource(preferences),
      );

      expect(await ids(restarted), ['new', 'a', 'b']);
      // The rewritten value is now fully readable, so later writes need no new backup.
      final stored =
          jsonDecode(
                preferences.getString(FavoritesLocalDataSource.storageKey)!,
              )
              as List;
      expect(stored, hasLength(3));
    });

    test('clear removes favorites and the corrupt backup', () async {
      final repository = await withStored([
        validEntry('a'),
        {'broken': true},
      ]);
      final preferences = await SharedPreferences.getInstance();
      await repository.add(createTestProduct(id: 'b'));
      expect(
        preferences.containsKey(FavoritesLocalDataSource.corruptBackupKey),
        isTrue,
      );

      await FavoritesLocalDataSource(preferences).clear();

      expect(await repository.list(), isEmpty);
      expect(
        preferences.containsKey(FavoritesLocalDataSource.corruptBackupKey),
        isFalse,
      );
    });
  });

  group('backup write failures', () {
    const favoritesKey = FavoritesLocalDataSource.storageKey;
    const backupKey = FavoritesLocalDataSource.corruptBackupKey;

    Map<String, dynamic> validEntry(String id) {
      return CachedProductSummaryModel.fromProduct(
        createTestProduct(id: id, name: 'Product $id'),
      ).toJson();
    }

    final corruptRaw = jsonEncode([
      validEntry('a'),
      {'broken': true},
      validEntry('b'),
    ]);

    /// Models what survives an app restart: only writes the platform reported as
    /// successful. Like SharedPreferences, the in-memory cache is always updated first.
    late Map<String, String> disk;
    late SharedPreferences preferences;

    setUp(() async {
      SharedPreferences.setMockInitialValues({favoritesKey: corruptRaw});
      preferences = await SharedPreferences.getInstance();
      disk = {favoritesKey: corruptRaw};
    });

    PreferenceStringWriter writer({
      required Future<bool> Function(String key, String value) backup,
    }) {
      return (key, value) async {
        await preferences.setString(key, value);
        if (key == backupKey) {
          return backup(key, value);
        }
        disk[key] = value;
        return true;
      };
    }

    LocalFavoritesRepository repositoryWith(PreferenceStringWriter write) {
      return LocalFavoritesRepository(
        FavoritesLocalDataSource(preferences, writeString: write),
      );
    }

    void expectOriginalSurvivesOnDisk() {
      final survives =
          disk[favoritesKey] == corruptRaw || disk[backupKey] == corruptRaw;
      expect(
        survives,
        isTrue,
        reason:
            'the unreadable original must stay on disk, in place or as a backup',
      );
    }

    for (final (label, failingBackup)
        in <(String, Future<bool> Function(String, String))>[
          ('reports false', (_, _) async => false),
          ('throws', (_, _) async => throw StateError('disk full')),
        ]) {
      test(
        'when the backup write $label, the favorites are not overwritten',
        () async {
          final repository = repositoryWith(writer(backup: failingBackup));

          await expectLater(
            repository.add(createTestProduct(id: 'new')),
            throwsA(isA<FavoritesBackupException>()),
          );

          expectOriginalSurvivesOnDisk();
          expect(disk[favoritesKey], corruptRaw);
          // The failed backup must not look like it exists, or the next write would skip it.
          expect(preferences.containsKey(backupKey), isFalse);
          expect(preferences.getString(favoritesKey), corruptRaw);
        },
      );
    }

    test(
      'after a failed backup, a later write retries the backup first',
      () async {
        await expectLater(
          repositoryWith(
            writer(backup: (_, _) async => false),
          ).add(createTestProduct(id: 'new')),
          throwsA(isA<FavoritesBackupException>()),
        );

        final working = writer(
          backup: (key, value) async {
            disk[key] = value;
            return true;
          },
        );
        await repositoryWith(working).remove('b');

        expect(disk[backupKey], corruptRaw);
        expect(
          (jsonDecode(disk[favoritesKey]!) as List).map(
            (entry) => (entry as Map)['id'],
          ),
          ['a'],
        );
      },
    );

    test(
      'concurrent adds while a slow backup is in flight keep both favorites',
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

        final first = repository.add(createTestProduct(id: 'x'));
        final second = repository.add(createTestProduct(id: 'y'));
        backupGate.complete();
        await Future.wait([first, second]);

        final ids = (await repository.list()).map((product) => product.id);
        expect(ids, containsAll(['x', 'y', 'a', 'b']));
        expect(ids, hasLength(4));
        expect(disk[backupKey], corruptRaw);
        expect(
          (jsonDecode(disk[favoritesKey]!) as List).map(
            (e) => (e as Map)['id'],
          ),
          unorderedEquals(['x', 'y', 'a', 'b']),
        );
      },
    );

    test(
      'concurrent add and remove on readable data keep both changes',
      () async {
        SharedPreferences.setMockInitialValues({
          favoritesKey: jsonEncode([validEntry('a'), validEntry('b')]),
        });
        preferences = await SharedPreferences.getInstance();
        final repository = LocalFavoritesRepository(
          FavoritesLocalDataSource(preferences),
        );

        await Future.wait([
          repository.add(createTestProduct(id: 'c')),
          repository.remove('a'),
        ]);

        expect(
          (await repository.list()).map((product) => product.id),
          unorderedEquals(['c', 'b']),
        );
      },
    );
  });
}
