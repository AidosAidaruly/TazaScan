import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/errors/app_exception.dart';
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
  const PhotoSearchScreen({super.key});

  @override
  State<PhotoSearchScreen> createState() => _PhotoSearchScreenState();
}

class _PhotoSearchScreenState extends State<PhotoSearchScreen> {
  final _picker = ImagePicker();
  final _service = const PhotoSearchService(HttpPhotoSearchRepository());

  bool _isLoading = false;
  String? _errorMessage;
  PhotoSearchResult? _result;

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

      if (image == null) {
        _setError('Поиск по фото отменен.');
        return;
      }

      final result = await _service.searchByImage(image);

      if (!mounted) return;
      setState(() {
        _result = result;
        _isLoading = false;
      });
    } on AppException catch (error) {
      _setError(error.message);
    } catch (_) {
      _setError('Не удалось прочитать это фото. Попробуй другое изображение.');
    }
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

  void _openSubmission() {
    Navigator.of(context).pushNamed(AppRoutes.productSubmission);
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;

    return Scaffold(
      appBar: AppBar(title: const Text('Поиск по фото')),
      body: ResponsivePage(
        child: ListView(
          children: [
            Text(
              'Найди продукт по фото',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'Сделай четкое фото лицевой стороны упаковки или выбери изображение из галереи.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 24),
            PhotoSourceButton(
              icon: Icons.photo_camera_rounded,
              label: 'Сделать фото',
              onPressed: _isLoading
                  ? null
                  : () => _pickAndSearch(ImageSource.camera),
            ),
            const SizedBox(height: 12),
            PhotoSourceButton(
              icon: Icons.photo_library_rounded,
              label: 'Выбрать из галереи',
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
              PhotoSearchEmptyState(
                message: result.message ?? 'Похожие продукты не найдены',
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: _openSubmission,
                child: const Text('Добавить продукт'),
              ),
            ],
            if (result != null && result.matches.isNotEmpty) ...[
              Text(
                result.query == null
                    ? 'Совпадения'
                    : 'Совпадения для «${result.query}»',
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
