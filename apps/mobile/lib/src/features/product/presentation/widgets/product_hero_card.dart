import 'package:flutter/material.dart';
import 'package:project/src/core/network/asset_url_resolver.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/presentation/widgets/product_grade_colors.dart';
import 'package:project/src/features/product/presentation/widgets/score_ring.dart';

class ProductHeroCard extends StatelessWidget {
  const ProductHeroCard({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final imageUrl = resolveApiAssetUrl(product.imageUrl);
    final gradeColor = ProductGradeColors.colorFor(
      product.nutritionScore.grade,
    );

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final isNarrow = constraints.maxWidth < 390;

              if (isNarrow) {
                return Column(
                  children: [
                    _ImagePanel(imageUrl: imageUrl, productName: product.name),
                    const SizedBox(height: 18),
                    ScoreRing(
                      score:
                          product.nutritionScore.score ?? product.healthScore,
                      grade: product.nutritionScore.grade,
                    ),
                  ],
                );
              }

              return Row(
                children: [
                  ScoreRing(
                    score: product.nutritionScore.score ?? product.healthScore,
                    grade: product.nutritionScore.grade,
                  ),
                  const SizedBox(width: 18),
                  Expanded(
                    child: _ImagePanel(
                      imageUrl: imageUrl,
                      productName: product.name,
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 20),
          Text(
            product.name,
            style: textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w900,
              height: 1.04,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            [product.brand, product.category].whereType<String>().join(' • '),
            style: textTheme.bodyLarge?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _Badge(
                label: 'Оценка ${product.nutritionScore.grade ?? 'нет'}',
                color: gradeColor,
              ),
              _Badge(
                label: _dataStatusLabel(product.dataStatus),
                color: _dataStatusColor(product.dataStatus),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _dataStatusLabel(String status) {
    return switch (status) {
      'verified' => 'Проверено',
      'community' => 'Сообщество',
      _ => 'Не проверено',
    };
  }

  Color _dataStatusColor(String status) {
    return switch (status) {
      'verified' => const Color(0xFF24C78E),
      'community' => const Color(0xFFF4C542),
      _ => const Color(0xFFA7B4C5),
    };
  }
}

class _ImagePanel extends StatelessWidget {
  const _ImagePanel({required this.imageUrl, required this.productName});

  final String? imageUrl;
  final String productName;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      height: 210,
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(24),
      ),
      child: imageUrl == null
          ? Icon(
              Icons.inventory_2_outlined,
              size: 72,
              color: colorScheme.primary,
            )
          : Image.network(
              imageUrl!,
              fit: BoxFit.contain,
              semanticLabel: productName,
              errorBuilder: (_, _, _) => Icon(
                Icons.inventory_2_outlined,
                size: 72,
                color: colorScheme.primary,
              ),
            ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});

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
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
