import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/favorites/data/datasources/favorites_local_data_source.dart';
import 'package:project/src/features/favorites/data/repositories/local_favorites_repository.dart';
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
}
