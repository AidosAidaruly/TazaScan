import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class ProductScoreSummaryCard extends StatelessWidget {
  const ProductScoreSummaryCard({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final reasons = [
      ...product.nutritionScore.negativeReasons,
      ...product.nutritionScore.warnings,
      ...product.nutritionScore.positiveReasons,
    ].take(3).toList();

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _summaryTitle(product.nutritionScore.grade),
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            reasons.isEmpty ? 'Дополнительных замечаний нет.' : reasons.first,
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

  String _summaryTitle(String? grade) {
    return switch (grade?.toUpperCase()) {
      'A' => 'Высокая пищевая оценка',
      'B' => 'Хорошая пищевая оценка',
      'C' => 'Средняя пищевая оценка',
      'D' => 'Низкая пищевая оценка',
      'E' => 'Очень низкая пищевая оценка',
      _ => 'Оценка требует данных',
    };
  }
}
