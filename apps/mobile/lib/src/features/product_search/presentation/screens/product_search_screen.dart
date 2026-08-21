import 'dart:async';

import 'package:flutter/material.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/network/asset_url_resolver.dart';
import 'package:project/src/core/network/api_client.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/data/repositories/http_product_repository.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/services/product_service.dart';
import 'package:project/src/features/product/presentation/scoring/taza_score_consumer_presentation.dart';

class ProductSearchScreen extends StatefulWidget {
  const ProductSearchScreen({this.productService, super.key});

  final ProductService? productService;

  @override
  State<ProductSearchScreen> createState() => _ProductSearchScreenState();
}

class _ProductSearchScreenState extends State<ProductSearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;

  bool _isLoading = false;
  String? _errorTitle;
  String? _errorMessage;
  String _lastSubmittedQuery = '';
  String _lastCompletedQuery = '';
  int _searchGeneration = 0;
  List<Product> _results = const [];
  List<String> _recentQueries = const [];

  ProductService get _service =>
      widget.productService ??
      ProductService(HttpProductRepository(ApiClient()));

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    final query = value.trim();

    if (query.length < 2) {
      _searchGeneration++;
      setState(() {
        _results = const [];
        _errorTitle = null;
        _errorMessage = null;
        _isLoading = false;
        _lastSubmittedQuery = '';
        _lastCompletedQuery = '';
      });
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 350), () {
      _search(query);
    });
  }

  Future<void> _search([String? rawQuery]) async {
    final query = (rawQuery ?? _controller.text).trim();
    _debounce?.cancel();

    if (query.length < 2) {
      _searchGeneration++;
      setState(() {
        _results = const [];
        _errorTitle = null;
        _errorMessage = null;
        _isLoading = false;
        _lastSubmittedQuery = '';
        _lastCompletedQuery = '';
      });
      return;
    }

    if (query == _lastSubmittedQuery &&
        (_isLoading ||
            (_errorMessage == null && _lastCompletedQuery == query))) {
      return;
    }

    final generation = ++_searchGeneration;
    setState(() {
      _isLoading = true;
      _errorTitle = null;
      _errorMessage = null;
      _lastSubmittedQuery = query;
    });

    try {
      final products = await _service.search(name: query, pageSize: 20);
      if (!mounted || generation != _searchGeneration) return;

      setState(() {
        _results = products;
        _isLoading = false;
        _lastCompletedQuery = query;
        _recentQueries = _updatedRecentQueries(query);
      });
    } on AppException catch (error) {
      _showError(_errorTitleFor(error), _errorMessageFor(error), generation);
    } catch (_) {
      _showError(
        'Не удалось выполнить поиск',
        'Проверьте подключение и попробуйте снова.',
        generation,
      );
    }
  }

  String _errorTitleFor(AppException error) {
    if (error is RequestTimeoutException) {
      return 'Сервер долго отвечает';
    }

    return 'Не удалось выполнить поиск';
  }

  String _errorMessageFor(AppException error) {
    if (error is RequestTimeoutException) {
      return 'Попробуйте снова.';
    }
    if (error is NetworkException) {
      return 'Проверьте подключение и попробуйте снова.';
    }

    return error.message;
  }

  void _showError(String title, String message, int generation) {
    if (!mounted || generation != _searchGeneration) return;

    setState(() {
      _errorTitle = title;
      _errorMessage = message;
      _isLoading = false;
      _lastCompletedQuery = _lastSubmittedQuery;
    });
  }

  void _clear() {
    _debounce?.cancel();
    _searchGeneration++;
    _controller.clear();
    setState(() {
      _results = const [];
      _errorTitle = null;
      _errorMessage = null;
      _isLoading = false;
      _lastSubmittedQuery = '';
      _lastCompletedQuery = '';
    });
  }

  void _openProduct(Product product) {
    Navigator.of(
      context,
    ).pushNamed(AppRoutes.productDetails, arguments: product);
  }

  void _openSubmission() {
    Navigator.of(context).pushNamed(AppRoutes.productSubmission);
  }

  List<String> _updatedRecentQueries(String query) {
    return [
      query,
      ..._recentQueries.where(
        (item) => item.toLowerCase() != query.toLowerCase(),
      ),
    ].take(5).toList();
  }

  @override
  Widget build(BuildContext context) {
    final hasQuery = _controller.text.trim().isNotEmpty;
    final hasSearched = _lastCompletedQuery.isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: const Text('Поиск продукта')),
      body: ResponsivePage(
        child: ListView(
          children: [
            _SearchField(
              controller: _controller,
              onChanged: _onQueryChanged,
              onSubmitted: _search,
              onClear: hasQuery ? _clear : null,
              isLoading: _isLoading,
            ),
            const SizedBox(height: 18),
            if (_recentQueries.isNotEmpty && !hasQuery) ...[
              _RecentQueries(
                queries: _recentQueries,
                onTap: (query) {
                  _controller.text = query;
                  _search(query);
                },
              ),
              const SizedBox(height: 18),
            ],
            if (_errorMessage != null) ...[
              _SearchMessage(
                icon: Icons.wifi_off_rounded,
                title: _errorTitle ?? 'Не удалось выполнить поиск',
                message: _errorMessage!,
                actionLabel: 'Повторить',
                onActionTap: () => _search(_lastSubmittedQuery),
              ),
            ] else if (!hasQuery && !hasSearched) ...[
              const _SearchMessage(
                icon: Icons.manage_search_rounded,
                title: 'Найдите продукт',
                message: 'Введите название или бренд.',
              ),
            ] else if (!_isLoading && hasSearched && _results.isEmpty) ...[
              _SearchMessage(
                icon: Icons.search_off_rounded,
                title: 'Ничего не найдено.',
                message: 'Не нашли продукт? Помогите добавить его.',
                actionLabel: 'Добавить продукт',
                onActionTap: _openSubmission,
              ),
            ] else ...[
              for (final product in _results) ...[
                _ProductSearchResultCard(
                  product: product,
                  onTap: () => _openProduct(product),
                ),
                const SizedBox(height: 12),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.onChanged,
    required this.onSubmitted,
    required this.onClear,
    required this.isLoading,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final VoidCallback? onClear;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return TextField(
      controller: controller,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: 'Название, бренд или штрихкод',
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: _SearchFieldSuffix(isLoading: isLoading, onClear: onClear),
        filled: true,
        fillColor: colorScheme.surfaceContainerHighest,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(22),
          borderSide: BorderSide(
            color: colorScheme.primary.withValues(alpha: 0.44),
          ),
        ),
      ),
    );
  }
}

class _SearchFieldSuffix extends StatelessWidget {
  const _SearchFieldSuffix({required this.isLoading, required this.onClear});

  final bool isLoading;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Padding(
        padding: EdgeInsets.all(14),
        child: SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }

    if (onClear == null) {
      return const SizedBox.shrink();
    }

    return IconButton(
      onPressed: onClear,
      icon: const Icon(Icons.close_rounded),
      tooltip: 'Очистить',
    );
  }
}

class _RecentQueries extends StatelessWidget {
  const _RecentQueries({required this.queries, required this.onTap});

  final List<String> queries;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final query in queries)
          ActionChip(
            label: Text(query),
            avatar: const Icon(Icons.history_rounded, size: 18),
            onPressed: () => onTap(query),
          ),
      ],
    );
  }
}

class _ProductSearchResultCard extends StatelessWidget {
  const _ProductSearchResultCard({required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final tazaScore = product.tazaScore;
    final score = tazaScore?.score;
    final scoreColor = TazaScoreConsumerPresentation.colorForScore(score);
    final subtitleParts = [
      if ((product.brand ?? '').trim().isNotEmpty) product.brand!.trim(),
      if ((product.category ?? '').trim().isNotEmpty) product.category!.trim(),
    ];

    return TazaCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _ProductImage(imageUrl: product.imageUrl),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    height: 1.12,
                  ),
                ),
                if (subtitleParts.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    subtitleParts.join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _ScorePill(
                      label: TazaScoreConsumerPresentation.shortLabel(
                        tazaScore,
                      ),
                      color: scoreColor,
                    ),
                    if (TazaScoreConsumerPresentation.shouldShowIncompleteHint(
                      tazaScore,
                    ))
                      const _SubtlePill(label: 'Неполные данные'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Icon(
            Icons.chevron_right_rounded,
            size: 22,
            color: colorScheme.onSurfaceVariant.withValues(alpha: 0.82),
          ),
        ],
      ),
    );
  }
}

class _ProductImage extends StatelessWidget {
  const _ProductImage({required this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final resolvedImageUrl = resolveApiAssetUrl(imageUrl);

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 72,
        height: 72,
        child: resolvedImageUrl == null
            ? ColoredBox(
                color: colorScheme.primary.withValues(alpha: 0.1),
                child: Icon(
                  Icons.inventory_2_outlined,
                  color: colorScheme.primary,
                ),
              )
            : Image.network(
                resolvedImageUrl,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => ColoredBox(
                  color: colorScheme.primary.withValues(alpha: 0.1),
                  child: Icon(
                    Icons.inventory_2_outlined,
                    color: colorScheme.primary,
                  ),
                ),
              ),
      ),
    );
  }
}

class _ScorePill extends StatelessWidget {
  const _ScorePill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w900,
            height: 1,
          ),
        ),
      ),
    );
  }
}

class _SubtlePill extends StatelessWidget {
  const _SubtlePill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surface.withValues(alpha: 0.46),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        child: Text(
          label,
          style: TextStyle(
            color: colorScheme.onSurfaceVariant,
            fontSize: 12,
            fontWeight: FontWeight.w800,
            height: 1,
          ),
        ),
      ),
    );
  }
}

class _SearchMessage extends StatelessWidget {
  const _SearchMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onActionTap,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onActionTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return TazaCard(
      child: Column(
        children: [
          Icon(icon, color: colorScheme.primary, size: 34),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          if (actionLabel != null && onActionTap != null) ...[
            const SizedBox(height: 14),
            FilledButton(onPressed: onActionTap, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}
