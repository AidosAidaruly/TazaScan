import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/photo_search/data/repositories/http_photo_search_repository.dart';
import 'package:project/src/features/photo_search/domain/entities/photo_search_result.dart';
import 'package:project/src/features/photo_search/domain/services/photo_search_service.dart';
import 'package:project/src/features/photo_search/presentation/widgets/photo_search_empty_state.dart';
import 'package:project/src/features/photo_search/presentation/widgets/photo_search_match_card.dart';
import 'package:project/src/features/photo_search/presentation/widgets/photo_source_button.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class PhotoSearchScreen extends StatefulWidget {
  const PhotoSearchScreen({
    this.initialResult,
    this.initialErrorMessage,
    this.photoSearchService,
    super.key,
  });

  final PhotoSearchResult? initialResult;
  final String? initialErrorMessage;
  final PhotoSearchService? photoSearchService;

  @override
  State<PhotoSearchScreen> createState() => _PhotoSearchScreenState();
}

class _PhotoSearchScreenState extends State<PhotoSearchScreen> {
  final _picker = ImagePicker();

  bool _isLoading = false;
  String? _errorMessage;
  PhotoSearchResult? _result;

  PhotoSearchService get _service =>
      widget.photoSearchService ??
      const PhotoSearchService(HttpPhotoSearchRepository());

  @override
  void initState() {
    super.initState();
    _result = widget.initialResult;
    _errorMessage = widget.initialErrorMessage;
  }

  Future<void> _pickAndSearch(ImageSource source) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _result = null;
    });

    try {
      final image = await _picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 1600,
      );
      if (!mounted) return;

      if (image == null) {
        _setError(
          context.t.pick(
            ru: 'Поиск по фото отменён.',
            kk: 'Фото бойынша іздеу тоқтатылды.',
          ),
        );
        return;
      }

      final result = await _service.searchByImage(image);

      if (!mounted) return;
      setState(() {
        _result = result;
        _isLoading = false;
      });
    } on AppException catch (error) {
      if (!mounted) return;
      _setError(_photoErrorMessage(error));
    } catch (_) {
      if (!mounted) return;
      _setError(context.t.cannotOpenImage);
    }
  }

  String _photoErrorMessage(AppException error) {
    if (error is RequestTimeoutException) {
      return context.t.serverSlow;
    }
    if (error is NetworkException) {
      return context.t.checkConnectionAndRetry;
    }

    return context.t.cannotUploadPhoto;
  }

  void _setError(String message) {
    if (!mounted) return;
    setState(() {
      _errorMessage = message;
      _isLoading = false;
    });
  }

  void _openProduct(Product product) {
    Navigator.of(
      context,
    ).pushNamed(AppRoutes.productDetails, arguments: product);
  }

  void _openScanner() {
    Navigator.of(context).pushNamed(AppRoutes.scanner);
  }

  void _openProductSearch() {
    Navigator.of(context).pushNamed(AppRoutes.productSearch);
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    final isDesktop =
        Platform.isWindows || Platform.isLinux || Platform.isMacOS;
    final t = context.t;

    return Scaffold(
      appBar: AppBar(title: Text(t.photoSearch)),
      body: ResponsivePage(
        child: ListView(
          children: [
            Text(
              t.pick(ru: 'Найди продукт по фото', kk: 'Өнімді фото арқылы тап'),
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              t.pick(
                ru: 'Сделай чёткое фото лицевой стороны упаковки или выбери изображение из галереи.',
                kk: 'Қаптаманың алдыңғы жағын анық түсір немесе галереядан сурет таңда.',
              ),
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 10),
            Text(
              t.photoGuidance,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 24),
            if (!isDesktop) ...[
              PhotoSourceButton(
                icon: Icons.photo_camera_rounded,
                label: t.takePhoto,
                onPressed: _isLoading
                    ? null
                    : () => _pickAndSearch(ImageSource.camera),
              ),
              const SizedBox(height: 12),
            ],
            PhotoSourceButton(
              icon: Icons.photo_library_rounded,
              label: isDesktop
                  ? t.pick(ru: 'Выбрать файл', kk: 'Файл таңдау')
                  : t.choosePhoto,
              onPressed: _isLoading
                  ? null
                  : () => _pickAndSearch(ImageSource.gallery),
            ),
            const SizedBox(height: 24),
            if (_isLoading) const LinearProgressIndicator(),
            if (_errorMessage != null) ...[
              PhotoSearchEmptyState(message: _errorMessage!),
            ],
            if (result != null && result.matches.isEmpty) ...[
              _PhotoSearchNoMatchState(
                onScan: _openScanner,
                onSearchByName: _openProductSearch,
                onTryAnotherPhoto: _isLoading
                    ? null
                    : () => _pickAndSearch(ImageSource.gallery),
              ),
            ],
            if (result != null && result.matches.isNotEmpty) ...[
              Text(
                result.query == null
                    ? t.pick(ru: 'Совпадения', kk: 'Сәйкестіктер')
                    : t.pick(
                        ru: 'Совпадения для «${result.query}»',
                        kk: '«${result.query}» үшін сәйкестіктер',
                      ),
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              for (final product in result.matches)
                PhotoSearchMatchCard(
                  product: product,
                  onTap: () => _openProduct(product),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PhotoSearchNoMatchState extends StatelessWidget {
  const _PhotoSearchNoMatchState({
    required this.onScan,
    required this.onSearchByName,
    required this.onTryAnotherPhoto,
  });

  final VoidCallback onScan;
  final VoidCallback onSearchByName;
  final VoidCallback? onTryAnotherPhoto;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final t = context.t;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        children: [
          Icon(
            Icons.image_search_rounded,
            color: colorScheme.primary,
            size: 38,
          ),
          const SizedBox(height: 12),
          Text(
            t.photoNoMatchTitle,
            textAlign: TextAlign.center,
            style: textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            t.photoNoMatchMessage,
            textAlign: TextAlign.center,
            style: textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onScan,
              icon: const Icon(Icons.qr_code_scanner_rounded),
              label: Text(t.scanBarcode),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onSearchByName,
              icon: const Icon(Icons.search_rounded),
              label: Text(t.findByName),
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: onTryAnotherPhoto,
            child: Text(t.chooseAnotherPhoto),
          ),
        ],
      ),
    );
  }
}
