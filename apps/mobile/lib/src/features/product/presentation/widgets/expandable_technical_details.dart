import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/presentation/widgets/product_presentation_localization.dart';

class ExpandableTechnicalDetails extends StatelessWidget {
  const ExpandableTechnicalDetails({
    required this.score,
    this.barcode,
    super.key,
  });

  final NutritionScore score;
  final String? barcode;

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
      title: Text(
        context.t.pick(
          ru: 'Как рассчитана оценка',
          kk: 'Баға қалай есептелді',
        ),
        style: const TextStyle(fontWeight: FontWeight.w900),
      ),
      children: [
        _TechRow(
          label: context.t.pick(ru: 'Алгоритм', kk: 'Алгоритм'),
          value: score.algorithm,
        ),
        _TechRow(
          label: context.t.pick(ru: 'Версия', kk: 'Нұсқа'),
          value: score.algorithmVersion,
        ),
        _TechRow(
          label: context.t.pick(ru: 'Дата расчёта', kk: 'Есептеу күні'),
          value: _formatDate(score.calculatedAt),
        ),
        _TechRow(
          label: context.t.pick(ru: 'Статус', kk: 'Мәртебе'),
          value: _statusLabel(context, score.status),
        ),
        if (barcode != null && barcode!.trim().isNotEmpty)
          _TechRow(
            label: context.t.pick(ru: 'Штрихкод', kk: 'Штрихкод'),
            value: barcode!,
          ),
        const SizedBox(height: 10),
        Text(
          context.t.pick(
            ru:
                'Расчёт основан на доступных данных продукта и может измениться после проверки информации.',
            kk:
                'Есеп қолжетімді өнім деректеріне негізделген және ақпарат тексерілгеннен кейін өзгеруі мүмкін.',
          ),
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

  static String _statusLabel(BuildContext context, String status) {
    if (status == 'offline_cached') {
      return context.t.pick(ru: 'Сохранённые данные', kk: 'Сақталған деректер');
    }

    return ProductPresentationLocalization.dataStatus(
      status,
      locale: context.tazaLocaleController.locale,
    );
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
