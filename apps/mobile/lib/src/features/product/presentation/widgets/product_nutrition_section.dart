import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class ProductNutritionSection extends StatelessWidget {
  const ProductNutritionSection({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final facts = product.nutritionFacts.entries.toList();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Пищевая ценность',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          for (final fact in facts)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Expanded(child: Text(_formatLabel(fact.key))),
                  Text(
                    '${fact.value}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _formatLabel(String value) {
    return switch (value) {
      'energyKcal' => 'Ккал',
      'protein' => 'Белки',
      'carbohydrates' => 'Углеводы',
      'sugars' => 'Сахар',
      'fat' => 'Жиры',
      'saturatedFat' => 'Насыщенные жиры',
      'fiber' => 'Клетчатка',
      'salt' => 'Соль',
      _ =>
        value
            .replaceAllMapped(
              RegExp(r'([A-Z])'),
              (match) => ' ${match.group(1)}',
            )
            .trim(),
    };
  }
}
