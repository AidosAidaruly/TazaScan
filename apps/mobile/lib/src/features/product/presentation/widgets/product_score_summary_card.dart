import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/presentation/widgets/product_presentation_localization.dart';

class ProductScoreSummaryCard extends StatelessWidget {
  const ProductScoreSummaryCard({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final locale = context.tazaLocaleController.locale;
    final reasons = [
      ...product.nutritionScore.negativeReasons,
      ...product.nutritionScore.warnings,
      ...product.nutritionScore.positiveReasons,
    ]
        .map((value) => ProductPresentationLocalization.insight(value, locale: locale))
        .take(3)
        .toList();

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _summaryTitle(context, product.nutritionScore.grade),
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            reasons.isEmpty ? context.t.noAdditionalNotes : reasons.first,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          if (reasons.length > 1) ...[
            const SizedBox(height: 12),
            for (final reason in reasons.skip(1)) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline_rounded, size: 17),
                  const SizedBox(width: 8),
                  Expanded(child: Text(reason)),
                ],
              ),
              const SizedBox(height: 7),
            ],
          ],
        ],
      ),
    );
  }

  String _summaryTitle(BuildContext context, String? grade) {
    return switch (grade?.toUpperCase()) {
      'A' => context.t.pick(ru: 'Высокая пищевая оценка', kk: 'Жоғары тағамдық баға'),
      'B' => context.t.pick(ru: 'Хорошая пищевая оценка', kk: 'Жақсы тағамдық баға'),
      'C' => context.t.pick(ru: 'Средняя пищевая оценка', kk: 'Орташа тағамдық баға'),
      'D' => context.t.pick(ru: 'Низкая пищевая оценка', kk: 'Төмен тағамдық баға'),
      'E' => context.t.pick(ru: 'Очень низкая пищевая оценка', kk: 'Өте төмен тағамдық баға'),
      _ => context.t.pick(ru: 'Оценка требует данных', kk: 'Бағалау үшін деректер қажет'),
    };
  }
}
