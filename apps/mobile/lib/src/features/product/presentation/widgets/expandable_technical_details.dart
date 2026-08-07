import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';

class ExpandableTechnicalDetails extends StatelessWidget {
  const ExpandableTechnicalDetails({required this.score, super.key});

  final NutritionScore score;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 18),
      childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      collapsedShape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
      ),
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
      collapsedBackgroundColor: Theme.of(
        context,
      ).colorScheme.surfaceContainerHighest,
      title: const Text(
        'Как рассчитана оценка',
        style: TextStyle(fontWeight: FontWeight.w900),
      ),
      children: [
        _TechRow(label: 'Алгоритм', value: score.algorithm),
        _TechRow(label: 'Версия', value: score.algorithmVersion),
        _TechRow(label: 'Дата расчёта', value: _formatDate(score.calculatedAt)),
        _TechRow(label: 'Статус', value: _statusLabel(score.status)),
        const SizedBox(height: 10),
        Text(
          'Расчёт основан на доступных данных продукта и может измениться после проверки информации.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  static String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}.'
        '${date.month.toString().padLeft(2, '0')}.${date.year}';
  }

  static String _statusLabel(String status) {
    return switch (status) {
      'calculated' => 'Рассчитано',
      'insufficient_data' => 'Недостаточно данных',
      'requires_review' => 'Требуется проверка',
      'offline_cached' => 'Сохранённые данные',
      _ => 'Неизвестно',
    };
  }
}

class _TechRow extends StatelessWidget {
  const _TechRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
