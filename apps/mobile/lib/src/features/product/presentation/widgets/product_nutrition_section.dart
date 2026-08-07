import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/presentation/widgets/nutrition_metric_card.dart';

class ProductNutritionSection extends StatelessWidget {
  const ProductNutritionSection({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final metrics = [
      _metric('energyKcal', 'Энергия', 'ккал', Icons.bolt_rounded),
      _metric('protein', 'Белки', 'г', Icons.fitness_center_rounded),
      _metric('carbohydrates', 'Углеводы', 'г', Icons.grain_rounded),
      _metric('sugars', 'Сахар', 'г', Icons.cookie_rounded),
      _metric('fat', 'Жиры', 'г', Icons.water_drop_rounded),
      _metric('saturatedFat', 'Насыщ. жиры', 'г', Icons.opacity_rounded),
      _metric('fiber', 'Клетчатка', 'г', Icons.spa_rounded),
      _metric('salt', 'Соль', 'г', Icons.scatter_plot_rounded),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Пищевая ценность',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.08,
          ),
          itemCount: metrics.length,
          itemBuilder: (context, index) => metrics[index],
        ),
      ],
    );
  }

  NutritionMetricCard _metric(
    String key,
    String label,
    String unit,
    IconData icon,
  ) {
    final value = _readNumber(product.nutritionFacts[key]);
    final interpretation = _interpret(key, value);

    return NutritionMetricCard(
      label: label,
      value: value,
      unit: unit,
      interpretation: interpretation.label,
      tone: interpretation.tone,
      icon: icon,
    );
  }

  num? _readNumber(Object? value) {
    if (value is num) {
      return value;
    }

    return null;
  }

  _MetricInterpretation _interpret(String key, num? value) {
    if (value == null) {
      return const _MetricInterpretation(
        'Данные отсутствуют',
        MetricTone.unknown,
      );
    }

    return switch (key) {
      'sugars' =>
        value >= 10
            ? const _MetricInterpretation(
                'Высокое содержание',
                MetricTone.negative,
              )
            : value >= 5
            ? const _MetricInterpretation(
                'Умеренное содержание',
                MetricTone.moderate,
              )
            : const _MetricInterpretation(
                'Низкое содержание',
                MetricTone.positive,
              ),
      'saturatedFat' =>
        value >= 5
            ? const _MetricInterpretation(
                'Высокое содержание',
                MetricTone.negative,
              )
            : value >= 1.5
            ? const _MetricInterpretation(
                'Умеренное содержание',
                MetricTone.moderate,
              )
            : const _MetricInterpretation(
                'Низкое содержание',
                MetricTone.positive,
              ),
      'salt' =>
        value >= 1.5
            ? const _MetricInterpretation(
                'Высокое содержание',
                MetricTone.negative,
              )
            : value >= 0.3
            ? const _MetricInterpretation(
                'Умеренное содержание',
                MetricTone.moderate,
              )
            : const _MetricInterpretation(
                'Низкое содержание',
                MetricTone.positive,
              ),
      'fiber' =>
        value >= 3
            ? const _MetricInterpretation('Есть клетчатка', MetricTone.positive)
            : const _MetricInterpretation(
                'Низкое содержание',
                MetricTone.moderate,
              ),
      'protein' =>
        value >= 5
            ? const _MetricInterpretation(
                'Заметное содержание',
                MetricTone.positive,
              )
            : const _MetricInterpretation(
                'Низкое содержание',
                MetricTone.unknown,
              ),
      _ => const _MetricInterpretation(
        'Информация с упаковки',
        MetricTone.unknown,
      ),
    };
  }
}

class _MetricInterpretation {
  const _MetricInterpretation(this.label, this.tone);

  final String label;
  final MetricTone tone;
}
