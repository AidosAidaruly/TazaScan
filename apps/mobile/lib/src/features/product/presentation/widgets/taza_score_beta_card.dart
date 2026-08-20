import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/presentation/widgets/product_grade_colors.dart';

class TazaScoreBetaCard extends StatefulWidget {
  const TazaScoreBetaCard({
    this.data,
    this.isLoading = false,
    this.errorMessage,
    this.onRetry,
    this.legacyScore,
    this.showLegacyComparison = false,
    super.key,
  });

  final TazaScorePreviewData? data;
  final bool isLoading;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final NutritionScore? legacyScore;
  final bool showLegacyComparison;

  @override
  State<TazaScoreBetaCard> createState() => _TazaScoreBetaCardState();
}

class _TazaScoreBetaCardState extends State<TazaScoreBetaCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final data = widget.data;
    final score = data?.score;
    final scoreColor = _scoreColor(score);

    return TazaSurfaceCard(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Pill(label: 'TazaScore', color: colorScheme.primary),
          const SizedBox(height: 14),
          if (widget.isLoading)
            const _LoadingPreview()
          else if (widget.errorMessage != null)
            _ErrorPreview(onRetry: widget.onRetry)
          else if (data == null)
            _ErrorPreview(onRetry: widget.onRetry)
          else if (data.status == TazaScorePreviewStatus.insufficientData)
            _InsufficientData(data: data)
          else ...[
            Center(
              child: Column(
                children: [
                  Text(
                    '${score ?? '—'}',
                    style: textTheme.displayMedium?.copyWith(
                      color: scoreColor,
                      fontWeight: FontWeight.w900,
                      height: 0.94,
                    ),
                  ),
                  Text(
                    '/ ${data.maxScore}',
                    style: textTheme.titleMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Оценка пищевого профиля продукта',
                    textAlign: TextAlign.center,
                    style: textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _NutriScoreRow(grade: data.nutriScoreGrade),
            if (data.isPartialData) ...[
              const SizedBox(height: 10),
              _ConfidenceInline(confidence: data.confidence),
            ],
            const SizedBox(height: 10),
            _CollapsedReasons(reasons: data.reasonLabels),
            _CollapsedNotices(data: data),
          ],
          if (data != null) ...[
            const SizedBox(height: 10),
            _DetailsToggle(
              expanded: _expanded,
              onTap: () => setState(() => _expanded = !_expanded),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutCubic,
              child: _expanded
                  ? _ExpandedDetails(
                      data: data,
                      legacyScore: widget.legacyScore,
                      showLegacyComparison: widget.showLegacyComparison,
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ],
      ),
    );
  }

  Color _scoreColor(int? score) {
    if (score == null) return const Color(0xFFA7B4C5);
    if (score >= 76) return const Color(0xFF24C78E);
    if (score >= 63) return const Color(0xFF8FD85A);
    if (score >= 45) return const Color(0xFFF4C542);
    if (score >= 25) return const Color(0xFFF59E42);
    return const Color(0xFFF45B69);
  }
}

class _CollapsedNotices extends StatelessWidget {
  const _CollapsedNotices({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    final notices = <String>[
      if (data.isPartialData) 'Оценка рассчитана по неполным данным продукта.',
      if (data.hasSafeguardApplied)
        'Итоговая оценка ограничена из-за отсутствующих важных данных.',
      if (data.confidence == TazaScoreConfidence.low)
        'Данных недостаточно для высокой точности оценки.',
    ];

    if (notices.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Column(
        children: [
          for (final notice in notices)
            _NoticeRow(
              text: notice,
              stronger: data.confidence == TazaScoreConfidence.low,
            ),
        ],
      ),
    );
  }
}

class _CollapsedReasons extends StatelessWidget {
  const _CollapsedReasons({required this.reasons});

  final List<String> reasons;

  @override
  Widget build(BuildContext context) {
    final values = reasons.isEmpty
        ? const ['Дополнительных замечаний нет.']
        : reasons.take(3).toList();

    return Column(
      children: [
        for (final reason in values)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  size: 17,
                  color: reasons.isEmpty
                      ? Theme.of(context).colorScheme.onSurfaceVariant
                      : ProductGradeColors.colorFor('E'),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    reason,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _NoticeRow extends StatelessWidget {
  const _NoticeRow({required this.text, this.stronger = false});

  final String text;
  final bool stronger;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            stronger
                ? Icons.error_outline_rounded
                : Icons.info_outline_rounded,
            size: 16,
            color: stronger
                ? const Color(0xFFF59E42)
                : colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: stronger
                    ? const Color(0xFFF4C542)
                    : colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w800,
                height: 1.25,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConfidenceInline extends StatelessWidget {
  const _ConfidenceInline({required this.confidence});

  final TazaScoreConfidence confidence;

  @override
  Widget build(BuildContext context) {
    return _InfoRow(
      label: 'Достоверность',
      value: _confidenceLabel(confidence),
    );
  }
}

class _DetailsToggle extends StatelessWidget {
  const _DetailsToggle({required this.expanded, required this.onTap});

  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Text(
                'Подробнее об оценке',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colorScheme.primary,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            Icon(
              expanded
                  ? Icons.keyboard_arrow_up_rounded
                  : Icons.keyboard_arrow_down_rounded,
              size: 20,
              color: colorScheme.primary,
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpandedDetails extends StatelessWidget {
  const _ExpandedDetails({
    required this.data,
    required this.legacyScore,
    required this.showLegacyComparison,
  });

  final TazaScorePreviewData data;
  final NutritionScore? legacyScore;
  final bool showLegacyComparison;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Breakdown(data: data),
          if (data.missingFields.isNotEmpty) ...[
            const SizedBox(height: 8),
            _FieldList(title: 'Не хватает данных', values: data.missingFields),
          ],
          if (data.hasSafeguardApplied) ...[
            const SizedBox(height: 8),
            const _NoticeRow(
              text: 'Для защиты от завышенной оценки применено ограничение.',
            ),
            if (data.scoreBeforeSafeguard != null)
              _InfoRow(
                label: 'До ограничения',
                value: '${data.scoreBeforeSafeguard}',
              ),
            if (data.score != null)
              _InfoRow(label: 'После ограничения', value: '${data.score}'),
          ],
          if (data.technicalReasonLabels.isNotEmpty) ...[
            const SizedBox(height: 10),
            for (final reason in data.technicalReasonLabels)
              _TechnicalReasonRow(reason: reason),
          ],
          const SizedBox(height: 12),
          Text(
            'TazaScore — оценка пищевого профиля продукта на основе Nutri-Score V2-2023 и доступных данных о составе. Не является медицинской рекомендацией.',
            style: textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
              height: 1.35,
            ),
          ),
          if (showLegacyComparison && legacyScore != null) ...[
            const SizedBox(height: 14),
            _LegacyComparison(score: legacyScore!),
          ],
        ],
      ),
    );
  }
}

class _FieldList extends StatelessWidget {
  const _FieldList({required this.title, required this.values});

  final String title;
  final List<String> values;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        for (final value in values)
          Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Row(
              children: [
                Icon(
                  Icons.remove_rounded,
                  size: 14,
                  color: colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    value,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _TechnicalReasonRow extends StatelessWidget {
  const _TechnicalReasonRow({required this.reason});

  final String reason;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.check_circle_outline_rounded,
            size: 15,
            color: colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              reason,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingPreview extends StatelessWidget {
  const _LoadingPreview();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Row(
        children: [
          SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2.4,
              color: colorScheme.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Загружаем новую оценку',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorPreview extends StatelessWidget {
  const _ErrorPreview({required this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Не удалось загрузить новую оценку',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: onRetry,
          style: TextButton.styleFrom(
            foregroundColor: colorScheme.primary,
            padding: EdgeInsets.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text('Повторить'),
        ),
      ],
    );
  }
}

class _NutriScoreRow extends StatelessWidget {
  const _NutriScoreRow({required this.grade});

  final String? grade;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final gradeLabel = grade?.toUpperCase();

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surface.withValues(alpha: 0.36),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                'Nutri-Score',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (gradeLabel == null)
              Flexible(
                child: Text(
                  'Недоступен из-за неполных данных',
                  textAlign: TextAlign.right,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              )
            else
              _GradeBadge(grade: gradeLabel),
          ],
        ),
      ),
    );
  }
}

class _Breakdown extends StatelessWidget {
  const _Breakdown({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _InfoRow(
          label: 'Достоверность данных',
          value: _confidenceLabel(data.confidence),
        ),
        if (data.nutritionCoverage != null)
          _InfoRow(
            label: 'Покрытие данных',
            value: _coverageLabel(data.nutritionCoverage!),
          ),
        _InfoRow(label: 'Добавки', value: data.ingredientAnalysisLabel),
        _InfoRow(label: 'Степень обработки', value: _processingLabel(data)),
        if (data.nutritionComponent != null)
          _InfoRow(
            label: 'Nutrition',
            value: '${data.nutritionComponent} / ${data.nutritionMax}',
          ),
        if (data.ingredientComponent != null)
          _InfoRow(
            label: 'Ingredients',
            value: '${data.ingredientComponent} / ${data.ingredientMax}',
          ),
      ],
    );
  }

  String _coverageLabel(double value) {
    return '${(value * 100).round()}%';
  }

  String _processingLabel(TazaScorePreviewData data) {
    if (data.processingLabel == 'Пока не учитывается в TazaScore') {
      return 'Пока не учитывается';
    }

    return data.processingLabel;
  }
}

class _InsufficientData extends StatelessWidget {
  const _InsufficientData({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Недостаточно данных',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        Text(
          data.missingFields.isEmpty
              ? 'Для расчёта TazaScore нужны дополнительные данные.'
              : 'Не хватает: ${data.missingFields.join(', ')}.',
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 14),
        _InfoRow(
          label: 'Достоверность данных',
          value: _confidenceLabel(data.confidence),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

class _LegacyComparison extends StatelessWidget {
  const _LegacyComparison({required this.score});

  final NutritionScore score;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final legacyValue = score.score == null ? '—' : '${score.score}/100';
    final legacyGrade = score.grade ?? '—';

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            Text(
              'Legacy',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w800,
              ),
            ),
            const Spacer(),
            Text(
              '$legacyValue + $legacyGrade',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GradeBadge extends StatelessWidget {
  const _GradeBadge({required this.grade});

  final String grade;

  @override
  Widget build(BuildContext context) {
    final color = ProductGradeColors.colorFor(grade);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        child: Text(
          grade,
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.color});

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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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

String _confidenceLabel(TazaScoreConfidence confidence) {
  return switch (confidence) {
    TazaScoreConfidence.high => 'Высокая',
    TazaScoreConfidence.medium => 'Средняя',
    TazaScoreConfidence.low => 'Низкая',
  };
}
