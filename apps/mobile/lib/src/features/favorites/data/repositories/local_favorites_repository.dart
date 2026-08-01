import 'package:project/src/features/favorites/data/datasources/favorites_local_data_source.dart';
import 'package:project/src/features/favorites/domain/repositories/favorites_repository.dart';
import 'package:project/src/features/product/data/models/cached_product_summary_model.dart';
import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class LocalFavoritesRepository implements FavoritesRepository {
  const LocalFavoritesRepository(this._dataSource);

  final FavoritesLocalDataSource _dataSource;

  @override
  Future<List<CachedProductSummary>> list() async {
    return _dataSource.readProducts();
  }

  @override
  Future<bool> isFavorite(String productId) async {
    return _dataSource
        .readProducts()
        .any((product) => product.id == productId);
  }

  @override
  Future<void> add(Product product) async {
    final products = _dataSource.readProducts().toList();
    if (products.any((item) => item.id == product.id)) {
      return;
    }

    products.insert(0, CachedProductSummaryModel.fromProduct(product));
    await _dataSource.writeProducts(products);
  }

  @override
  Future<void> remove(String productId) async {
    final products = _dataSource
        .readProducts()
        .where((product) => product.id != productId)
        .toList();

    await _dataSource.writeProducts(products);
  }
}
