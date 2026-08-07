import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';

enum MetricTone { positive, moderate, negative, unknown }

class NutritionMetricCard extends StatelessWidget {
  const NutritionMetricCard({
    required this.label,
    required this.value,
    required this.unit,
    required this.interpretation,
    required this.tone,
    required this.icon,
    super.key,
  });

  final String label;
  final num? value;
  final String unit;
  final String interpretation;
  final MetricTone tone;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final color = _toneColor(tone);
    final textTheme = Theme.of(context).textTheme;

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value == null ? 'Нет данных' : '${_formatValue(value!)} $unit',
            style: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 5),
          Text(
            interpretation,
            style: textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
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
}
