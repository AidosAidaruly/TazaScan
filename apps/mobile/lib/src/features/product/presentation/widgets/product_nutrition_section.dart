import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/presentation/widgets/nutrition_metric_card.dart';

class ProductNutritionSection extends StatelessWidget {
  const ProductNutritionSection({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final mainMetrics = [
      _metric('energyKcal', 'Энергия', 'ккал', Icons.bolt_rounded),
      _metric('protein', 'Белки', 'г', Icons.fitness_center_rounded),
      _metric('carbohydrates', 'Углеводы', 'г', Icons.grain_rounded),
      _metric('sugars', 'Сахар', 'г', Icons.cookie_rounded),
    ];
    final secondaryMetrics = [
      _nutritionMetric('fat', 'Жиры', 'г', Icons.water_drop_rounded),
      _nutritionMetric(
        'saturatedFat',
        'Насыщенные жиры',
        'г',
        Icons.opacity_rounded,
      ),
      _nutritionMetric('fiber', 'Клетчатка', 'г', Icons.spa_rounded),
      _nutritionMetric('salt', 'Соль', 'г', Icons.scatter_plot_rounded),
    ];
    final basisLabel = _nutritionBasisLabel();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(basisLabel: basisLabel),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) {
            final isVeryNarrow = constraints.maxWidth < 340;

            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: isVeryNarrow ? 1.18 : 1.32,
              ),
              itemCount: mainMetrics.length,
              itemBuilder: (context, index) => mainMetrics[index],
            );
          },
        ),
        const SizedBox(height: 14),
        _SecondaryNutritionList(metrics: secondaryMetrics),
        if (basisLabel != null) ...[
          const SizedBox(height: 10),
          Text(
            'Данные указаны $basisLabel',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }

  _NutritionMetric _nutritionMetric(
    String key,
    String label,
    String unit,
    IconData icon,
  ) {
    final value = _readNumber(product.nutritionFacts[key]);
    final interpretation = _interpret(key, value);

    return _NutritionMetric(
      label: label,
      value: value,
      unit: unit,
      interpretation: interpretation.label,
      tone: interpretation.tone,
      icon: icon,
    );
  }

  NutritionMetricCard _metric(
    String key,
    String label,
    String unit,
    IconData icon,
  ) {
    final metric = _nutritionMetric(key, label, unit, icon);

    return NutritionMetricCard(
      label: metric.label,
      value: metric.value,
      unit: metric.unit,
      interpretation: metric.interpretation,
      tone: metric.tone,
      icon: metric.icon,
    );
  }

  String? _nutritionBasisLabel() {
    final rawValue =
        product.nutritionFacts['basis'] ??
        product.nutritionFacts['per'] ??
        product.nutritionFacts['servingBasis'] ??
        product.nutritionFacts['nutritionBasis'];
    if (rawValue is! String) {
      return null;
    }

    final value = rawValue.trim().toLowerCase();
    if (value.isEmpty) {
      return null;
    }

    if (value.contains('100') &&
        (value.contains('ml') || value.contains('мл'))) {
      return 'на 100 мл';
    }
    if (value.contains('100') && (value.contains('g') || value.contains('г'))) {
      return 'на 100 г';
    }

    return null;
  }

  num? _readNumber(Object? value) {
    if (value is num) {
      return value;
    }

    return null;
  }

  _MetricInterpretation _interpret(String key, num? value) {
    if (value == null) {
      return const _MetricInterpretation('Нет данных', MetricTone.unknown);
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
      'energyKcal' => const _MetricInterpretation(
        'Информация о калорийности',
        MetricTone.unknown,
      ),
      'carbohydrates' => const _MetricInterpretation(
        'Всего углеводов',
        MetricTone.unknown,
      ),
      _ => const _MetricInterpretation('Показатель', MetricTone.unknown),
    };
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.basisLabel});

  final String? basisLabel;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final secondaryColor = Theme.of(context).colorScheme.onSurfaceVariant;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Пищевая ценность',
          style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
        ),
        if (basisLabel != null) ...[
          const SizedBox(height: 3),
          Text(
            basisLabel!,
            style: textTheme.bodySmall?.copyWith(color: secondaryColor),
          ),
        ],
      ],
    );
  }
}

class _SecondaryNutritionList extends StatelessWidget {
  const _SecondaryNutritionList({required this.metrics});

  final List<_NutritionMetric> metrics;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Column(
          children: [
            for (var index = 0; index < metrics.length; index++) ...[
              _SecondaryNutritionRow(metric: metrics[index]),
              if (index < metrics.length - 1)
                Divider(
                  height: 1,
                  thickness: 1,
                  color: colorScheme.outlineVariant.withValues(alpha: 0.38),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SecondaryNutritionRow extends StatelessWidget {
  const _SecondaryNutritionRow({required this.metric});

  final _NutritionMetric metric;

  @override
  Widget build(BuildContext context) {
    final color = _toneColor(metric.tone);
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(metric.icon, size: 15, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              metric.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  metric.value == null
                      ? '—'
                      : '${_formatValue(metric.value!)} ${metric.unit}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (metric.tone != MetricTone.unknown)
                  Text(
                    metric.interpretation,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodySmall?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w600,
                    ),
                  )
                else if (metric.value == null)
                  Text(
                    metric.interpretation,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NutritionMetric {
  const _NutritionMetric({
    required this.label,
    required this.value,
    required this.unit,
    required this.interpretation,
    required this.tone,
    required this.icon,
  });

  final String label;
  final num? value;
  final String unit;
  final String interpretation;
  final MetricTone tone;
  final IconData icon;
}

String _formatValue(num value) {
  if (value % 1 == 0) {
    return value.toInt().toString();
  }

  return value.toStringAsFixed(1);
}

Color _toneColor(MetricTone tone) {
  return switch (tone) {
    MetricTone.positive => const Color(0xFF24C78E),
    MetricTone.moderate => const Color(0xFFF4C542),
    MetricTone.negative => const Color(0xFFF45B69),
    MetricTone.unknown => const Color(0xFFA7B4C5),
  };
}

class _MetricInterpretation {
  const _MetricInterpretation(this.label, this.tone);

  final String label;
  final MetricTone tone;
}
