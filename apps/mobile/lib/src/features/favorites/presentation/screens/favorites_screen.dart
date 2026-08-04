import 'package:flutter/material.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/favorites/data/datasources/favorites_local_data_source.dart';
import 'package:project/src/features/favorites/data/repositories/local_favorites_repository.dart';
import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';
import 'package:project/src/features/product/domain/entities/product_details_args.dart';
import 'package:project/src/features/product/presentation/widgets/cached_product_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  LocalFavoritesRepository? _repository;
  List<CachedProductSummary> _products = const [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final preferences = await SharedPreferences.getInstance();
    final repository = LocalFavoritesRepository(
      FavoritesLocalDataSource(preferences),
    );
    final products = await repository.list();

    if (!mounted) return;
    setState(() {
      _repository = repository;
      _products = products;
      _isLoading = false;
    });
  }

  Future<void> _remove(String productId) async {
    await _repository?.remove(productId);
    await _load();
  }

  void _open(CachedProductSummary product) {
    Navigator.of(context).pushNamed(
      AppRoutes.productDetails,
      arguments: ProductDetailsArgs(
        product: product.toCachedProduct(),
        refreshFromNetwork: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Избранное')),
      body: ResponsivePage(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _FavoritesList(
                products: _products,
                onTap: _open,
                onRemove: _remove,
              ),
      ),
    );
  }
}

class _FavoritesList extends StatelessWidget {
  const _FavoritesList({
    required this.products,
    required this.onTap,
    required this.onRemove,
  });

  final List<CachedProductSummary> products;
  final ValueChanged<CachedProductSummary> onTap;
  final ValueChanged<String> onRemove;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return const Center(child: Text('В избранном пока пусто.'));
    }

    return ListView(
      children: [
        for (final product in products)
          CachedProductCard(
            product: product,
            onTap: () => onTap(product),
            trailing: IconButton(
              tooltip: 'Убрать из избранного',
              onPressed: () => onRemove(product.id),
              icon: const Icon(Icons.favorite_rounded),
            ),
          ),
      ],
    );
  }
}
