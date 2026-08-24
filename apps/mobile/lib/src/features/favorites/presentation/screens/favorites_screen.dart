import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/favorites/data/datasources/favorites_local_data_source.dart';
import 'package:project/src/features/favorites/data/repositories/local_favorites_repository.dart';
import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';
import 'package:project/src/features/product/domain/entities/product_details_args.dart';
import 'package:project/src/features/product/presentation/widgets/consumer_product_card.dart';
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

  void _openSearch() {
    Navigator.of(context).pushNamed(AppRoutes.productSearch);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.t.favorites)),
      body: ResponsivePage(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _FavoritesList(
                products: _products,
                onTap: _open,
                onRemove: _remove,
                onSearch: _openSearch,
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
    required this.onSearch,
  });

  final List<CachedProductSummary> products;
  final ValueChanged<CachedProductSummary> onTap;
  final ValueChanged<String> onRemove;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return _EmptyState(
        icon: Icons.favorite_border_rounded,
        title: context.t.favoritesEmpty,
        message: context.t.pick(
          ru:
              'Добавляйте продукты в избранное, чтобы быстро возвращаться к ним.',
          kk: 'Өнімдерді таңдаулыларға қосып, оларға тез оралыңыз.',
        ),
        actionLabel: context.t.productSearch,
        onActionTap: onSearch,
      );
    }

    return ListView(
      children: [
        for (final product in products) ...[
          ConsumerProductCard.fromCached(
            product: product,
            onTap: () => onTap(product),
            trailing: IconButton(
              tooltip: context.t.pick(
                ru: 'Убрать из избранного',
                kk: 'Таңдаулылардан алып тастау',
              ),
              onPressed: () => onRemove(product.id),
              icon: const Icon(Icons.favorite_rounded),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onActionTap,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onActionTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 72, horizontal: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colorScheme.primary, size: 38),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: onActionTap, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}
