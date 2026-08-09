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
    final colorScheme = Theme.of(context).colorScheme;

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: color.withValues(
                    alpha: tone == MetricTone.negative ? 0.16 : 0.12,
                  ),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(icon, size: 15, color: color),
              ),
              const SizedBox(width: 8),
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
          const SizedBox(height: 10),
          Text(
            value == null ? '—' : '${_formatValue(value!)} $unit',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            interpretation,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: textTheme.bodySmall?.copyWith(
              color: tone == MetricTone.unknown
                  ? colorScheme.onSurfaceVariant
                  : color,
              height: 1.15,
              fontWeight: tone == MetricTone.negative
                  ? FontWeight.w800
                  : FontWeight.w600,
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
