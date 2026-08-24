import 'dart:async';

import 'package:flutter/material.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/network/api_client.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/data/repositories/http_product_repository.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/services/product_service.dart';
import 'package:project/src/features/product/presentation/widgets/consumer_product_card.dart';

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
      if (!mounted) return;
      _showError(_errorTitleFor(error), _errorMessageFor(error), generation);
    } catch (_) {
      if (!mounted) return;
      _showError(
        context.t.searchFailed,
        context.t.checkConnectionAndRetry,
        generation,
      );
    }
  }

  String _errorTitleFor(AppException error) {
    if (error is RequestTimeoutException) {
      return context.t.serverSlow;
    }

    return context.t.searchFailed;
  }

  String _errorMessageFor(AppException error) {
    if (error is RequestTimeoutException) {
      return context.t.tryAgain;
    }
    if (error is NetworkException) {
      return context.t.checkConnectionAndRetry;
    }

    return context.t.checkConnectionAndRetry;
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
    final t = context.t;

    return Scaffold(
      appBar: AppBar(title: Text(t.productSearch)),
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
                icon: Icons.signal_wifi_off_rounded,
                title: _errorTitle ?? t.searchFailed,
                message: _errorMessage!,
                actionLabel: t.retry,
                onActionTap: () => _search(_lastSubmittedQuery),
              ),
            ] else if (!hasQuery && !hasSearched) ...[
              _SearchMessage(
                icon: Icons.manage_search_rounded,
                title: t.findProduct,
                message: t.enterNameOrBrand,
              ),
            ] else if (!_isLoading && hasSearched && _results.isEmpty) ...[
              _SearchMessage(
                icon: Icons.search_off_rounded,
                title: t.nothingFound,
                message: t.helpAddProduct,
                actionLabel: t.addProduct,
                onActionTap: _openSubmission,
              ),
            ] else ...[
              for (final product in _results) ...[
                ConsumerProductCard.fromProduct(
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
    final t = context.t;

    return TextField(
      controller: controller,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: t.searchHint,
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
      tooltip: context.t.clear,
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
