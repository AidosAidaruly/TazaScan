import 'package:flutter/material.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/network/api_client.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/favorites/data/datasources/favorites_local_data_source.dart';
import 'package:project/src/features/favorites/data/repositories/local_favorites_repository.dart';
import 'package:project/src/features/history/data/datasources/history_local_data_source.dart';
import 'package:project/src/features/history/data/repositories/local_history_repository.dart';
import 'package:project/src/features/product/data/repositories/http_product_repository.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/services/product_service.dart';
import 'package:project/src/features/product/presentation/widgets/expandable_technical_details.dart';
import 'package:project/src/features/product/presentation/widgets/nutrition_score_details_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_disclaimer.dart';
import 'package:project/src/features/product/presentation/widgets/product_data_reliability_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_hero_card.dart';
import 'package:project/src/features/product/presentation/widgets/product_info_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_nutrition_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_score_summary_card.dart';
import 'package:project/src/features/product/presentation/widgets/taza_score_beta_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ProductDetailsScreen extends StatefulWidget {
  const ProductDetailsScreen({
    required this.product,
    this.refreshFromNetwork = false,
    this.productService,
    this.enableTazaScorePreview = true,
    super.key,
  });

  final Product product;
  final bool refreshFromNetwork;
  final ProductService? productService;
  final bool enableTazaScorePreview;

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  late Product _product;
  bool _isFavorite = false;
  bool _isOfflineData = false;
  bool _isTazaScorePreviewLoading = false;
  TazaScorePreviewData? _tazaScorePreviewData;
  Object? _tazaScorePreviewError;
  LocalFavoritesRepository? _favoritesRepository;
  LocalHistoryRepository? _historyRepository;

  @override
  void initState() {
    super.initState();
    _product = widget.product;
    _tazaScorePreviewData = widget.product.tazaScore;
    _isOfflineData = widget.refreshFromNetwork;
    _initLocalState();
    if (widget.enableTazaScorePreview && _tazaScorePreviewData == null) {
      _loadTazaScorePreview();
    }
    if (widget.refreshFromNetwork) {
      _refreshProduct();
    }
  }

  Future<void> _initLocalState() async {
    final preferences = await SharedPreferences.getInstance();
    final favoritesRepository = LocalFavoritesRepository(
      FavoritesLocalDataSource(preferences),
    );
    final historyRepository = LocalHistoryRepository(
      HistoryLocalDataSource(preferences),
    );
    final isFavorite = await favoritesRepository.isFavorite(_product.id);
    await historyRepository.saveViewedProduct(_product);

    if (!mounted) return;
    setState(() {
      _favoritesRepository = favoritesRepository;
      _historyRepository = historyRepository;
      _isFavorite = isFavorite;
    });
  }

  Future<void> _refreshProduct() async {
    try {
      final service =
          widget.productService ??
          ProductService(HttpProductRepository(ApiClient()));
      final freshProduct = await service.findByBarcode(_product.barcode);
      await _historyRepository?.saveViewedProduct(freshProduct);

      if (!mounted) return;
      setState(() {
        _product = freshProduct;
        _tazaScorePreviewData = freshProduct.tazaScore;
        _isOfflineData = false;
      });
      if (widget.enableTazaScorePreview && _tazaScorePreviewData == null) {
        await _loadTazaScorePreview();
      }
    } on AppException {
      if (!mounted) return;
      setState(() {
        _isOfflineData = true;
      });
    }
  }

  Future<void> _toggleFavorite() async {
    final repository = _favoritesRepository;
    if (repository == null) return;

    if (_isFavorite) {
      await repository.remove(_product.id);
    } else {
      await repository.add(_product);
    }

    if (!mounted) return;
    setState(() {
      _isFavorite = !_isFavorite;
    });
  }

  Future<void> _loadTazaScorePreview() async {
    final productId = _product.id;
    setState(() {
      _isTazaScorePreviewLoading = _tazaScorePreviewData == null;
      _tazaScorePreviewError = null;
    });

    try {
      final service =
          widget.productService ??
          ProductService(HttpProductRepository(ApiClient()));
      final preview = await service.previewScore(productId);

      if (!mounted || _product.id != productId) return;
      setState(() {
        _tazaScorePreviewData = preview;
        _isTazaScorePreviewLoading = false;
      });
    } catch (error) {
      if (!mounted || _product.id != productId) return;
      setState(() {
        if (_tazaScorePreviewData == null) {
          _tazaScorePreviewError = error;
        }
        _isTazaScorePreviewLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Детали продукта'),
        actions: [
          IconButton(
            tooltip: _isFavorite
                ? 'Убрать из избранного'
                : 'Добавить в избранное',
            onPressed: _toggleFavorite,
            icon: Icon(
              _isFavorite ? Icons.favorite_rounded : Icons.favorite_border,
            ),
          ),
        ],
      ),
      body: ResponsivePage(
        child: ListView(
          children: [
            if (_isOfflineData) ...[
              const _OfflineNotice(),
              const SizedBox(height: 12),
            ],
            ProductHeroCard(
              product: _product,
              showScore: !widget.enableTazaScorePreview,
            ),
            const SizedBox(height: 16),
            if (widget.enableTazaScorePreview)
              TazaScoreBetaCard(
                data: _tazaScorePreviewData,
                isLoading: _isTazaScorePreviewLoading,
                errorMessage: _tazaScorePreviewError?.toString(),
                onRetry: _loadTazaScorePreview,
                legacyScore: _product.nutritionScore,
              )
            else
              ProductScoreSummaryCard(product: _product),
            const SizedBox(height: 24),
            ProductNutritionSection(product: _product),
            if (!widget.enableTazaScorePreview) ...[
              const SizedBox(height: 24),
              NutritionScoreDetailsSection(score: _product.nutritionScore),
            ],
            const SizedBox(height: 16),
            ProductInfoSection(product: _product),
            const SizedBox(height: 16),
            ProductDataReliabilitySection(product: _product),
            const SizedBox(height: 16),
            if (!widget.enableTazaScorePreview)
              ExpandableTechnicalDetails(
                score: _product.nutritionScore,
                barcode: _product.barcode,
              ),
            const SizedBox(height: 18),
            const ProductDisclaimer(),
          ],
        ),
      ),
    );
  }
}

class _OfflineNotice extends StatelessWidget {
  const _OfflineNotice();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.secondaryContainer,
      borderRadius: BorderRadius.circular(8),
      child: const Padding(
        padding: EdgeInsets.all(12),
        child: Text(
          'Офлайн-данные. Мы обновим детали, когда появится интернет.',
        ),
      ),
    );
  }
}
