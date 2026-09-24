import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/presentation/scoring/taza_score_consumer_presentation.dart';
import 'package:project/src/features/product/presentation/widgets/product_grade_colors.dart';
import 'package:project/src/features/product/presentation/widgets/product_presentation_localization.dart';

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
    final data = widget.data;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TazaSurfaceCard(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.isLoading)
                const _LoadingPreview()
              else if (widget.errorMessage != null)
                _ErrorPreview(onRetry: widget.onRetry)
              else if (data == null)
                _ErrorPreview(onRetry: widget.onRetry)
              else if (data.status == TazaScorePreviewStatus.insufficientData)
                _InsufficientData(data: data)
              else ...[
                _ScoreHero(data: data),
                const SizedBox(height: 10),
                _ScoreScale(score: data.score),
                const SizedBox(height: 14),
                _WhyThisScore(data: data),
                _ConsumerNotices(data: data),
              ],
              if (data != null) ...[
                const SizedBox(height: 6),
                _DetailsToggle(
                  expanded: _expanded,
                  onTap: () => setState(() => _expanded = !_expanded),
                ),
                AnimatedSize(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOutCubic,
                  child: _expanded
                      ? _ReliabilityDetails(
                          data: data,
                          legacyScore: widget.legacyScore,
                          showLegacyComparison: widget.showLegacyComparison,
                        )
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
        if (data != null && data.status == TazaScorePreviewStatus.calculated) ...[
          const SizedBox(height: 10),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _NutriScoreCard(grade: data.nutriScoreGrade)),
                const SizedBox(width: 10),
                Expanded(child: _ConfidenceCard(data: data)),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// Compact ring + "TAZASCORE / status / short interpretation" header row,
/// replacing the previous oversized centered number.
class _ScoreHero extends StatelessWidget {
  const _ScoreHero({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final score = data.score;
    final color = _scoreColor(score);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _TazaScoreRing(score: score, maxScore: data.maxScore),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TazaScore',
                style: textTheme.labelMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                context.t.scoreCategory(score),
                style: textTheme.headlineSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _scoreInterpretation(context, score),
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Small, compact score ring: value + "/ max" centered inside a thin
/// progress arc colored by the score's status band.
class _TazaScoreRing extends StatelessWidget {
  const _TazaScoreRing({required this.score, required this.maxScore});

  final int? score;
  final int maxScore;

  static const _diameter = 92.0;

  @override
  Widget build(BuildContext context) {
    final color = _scoreColor(score);
    final progress = maxScore <= 0
        ? 0.0
        : ((score ?? 0) / maxScore).clamp(0.0, 1.0);
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return SizedBox(
      width: _diameter,
      height: _diameter,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: const Size.square(_diameter),
            painter: _TazaScoreRingPainter(
              progress: progress,
              color: color,
              trackColor: color.withValues(alpha: 0.14),
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                score?.toString() ?? '—',
                style: textTheme.headlineMedium?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w900,
                  height: 1,
                ),
              ),
              Text(
                '/ $maxScore',
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TazaScoreRingPainter extends CustomPainter {
  const _TazaScoreRingPainter({
    required this.progress,
    required this.color,
    required this.trackColor,
  });

  final double progress;
  final Color color;
  final Color trackColor;

  @override
  void paint(Canvas canvas, Size size) {
    const strokeWidth = 8.0;
    final rect = Offset.zero & size;
    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    final progressPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      rect.deflate(strokeWidth / 2),
      -math.pi / 2,
      math.pi * 2,
      false,
      trackPaint,
    );
    canvas.drawArc(
      rect.deflate(strokeWidth / 2),
      -math.pi / 2,
      math.pi * 2 * progress,
      false,
      progressPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _TazaScoreRingPainter oldDelegate) {
    return progress != oldDelegate.progress ||
        color != oldDelegate.color ||
        trackColor != oldDelegate.trackColor;
  }
}

/// Segmented low-to-high scale (matching the Низкий/Средний/Хороший/
/// Отличный bands), with the current score's segment highlighted. Purely
/// decorative — it does not recompute anything, only visualizes the
/// already-calculated score.
class _ScoreScale extends StatelessWidget {
  const _ScoreScale({required this.score});

  final int? score;

  // One representative score per band, used only to look up that band's own
  // hue for the muted (inactive) segments — not a recalculation of anything.
  static const _bandSampleScores = [15, 50, 70, 90];

  @override
  Widget build(BuildContext context) {
    final activeIndex = _activeSegment(score);

    return Row(
      children: [
        for (var index = 0; index < 4; index++) ...[
          if (index > 0) const SizedBox(width: 6),
          Expanded(
            child: Container(
              height: 6,
              decoration: BoxDecoration(
                color: index == activeIndex
                    ? _scoreColor(score)
                    : _scoreColor(_bandSampleScores[index]).withValues(
                        alpha: 0.22,
                      ),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
        ],
      ],
    );
  }

  int _activeSegment(int? score) {
    if (score == null) return -1;
    if (score >= 80) return 3;
    if (score >= 60) return 2;
    if (score >= 40) return 1;
    return 0;
  }
}

class _WhyThisScore extends StatelessWidget {
  const _WhyThisScore({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    final reasonValues =
        data.reasonCodes.isNotEmpty ? data.reasonCodes : data.reasonLabels;
    final reasons = reasonValues.isEmpty
        ? [context.t.noAdditionalNotes]
        : reasonValues
            .map(
              (reason) => ProductPresentationLocalization.insight(
                reason,
                locale: context.tazaLocaleController.locale,
              ),
            )
            .take(3)
            .toList();
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.t.whyThisScore,
          style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 6),
        for (final reason in reasons)
          _ReasonRow(
            reason: reason,
            isNeutral: data.reasonLabels.isEmpty,
          ),
      ],
    );
  }
}

/// Compact reason row with a small colored icon badge, rather than a long
/// paragraph.
class _ReasonRow extends StatelessWidget {
  const _ReasonRow({required this.reason, required this.isNeutral});

  final String reason;
  final bool isNeutral;

  @override
  Widget build(BuildContext context) {
    final color = isNeutral ? Theme.of(context).colorScheme.onSurfaceVariant : _reasonColor(reason);

    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              _reasonIcon(reason, isNeutral: isNeutral),
              size: 13,
              color: color,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              reason,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
                height: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConsumerNotices extends StatelessWidget {
  const _ConsumerNotices({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    final notices = <String>[
      if (data.isPartialData)
        context.t.partialDataNotice,
      if (data.safeguardsApplied.contains('beverage_official_metadata_cap'))
        context.t.pick(
          ru:
              'Для напитка не хватает части данных, поэтому итоговая оценка ограничена.',
          kk:
              'Сусын үшін кейбір деректер жоқ, сондықтан қорытынды баға шектелді.',
        ),
      if (data.hasSafeguardApplied &&
          !data.safeguardsApplied.contains('beverage_official_metadata_cap'))
        context.t.scoreLimitedByMissingData,
      if (data.confidence == TazaScoreConfidence.low)
        context.t.lowConfidenceNotice,
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

class _ReliabilityDetails extends StatelessWidget {
  const _ReliabilityDetails({
    required this.data,
    required this.legacyScore,
    required this.showLegacyComparison,
  });

  final TazaScorePreviewData data;
  final NutritionScore? legacyScore;
  final bool showLegacyComparison;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.t.scoreReliability,
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          _InfoRow(
            label: context.t.additives,
            value: context.t.informationalAnalysis,
          ),
          _InfoRow(
            label: context.t.processingDegree,
            value: context.t.processingNotScored,
          ),
          if (data.nutritionComponent != null)
            _InfoRow(
              label: context.t.nutritionProfile,
              value: '${data.nutritionComponent} / ${data.nutritionMax}',
            ),
          if (data.ingredientComponent != null)
            _InfoRow(
              label: context.t.ingredientsAndAdditives,
              value: '${data.ingredientComponent} / ${data.ingredientMax}',
            ),
          if (data.missingCriticalFields.isNotEmpty) ...[
            const SizedBox(height: 8),
            _FieldList(
              title: context.t.missingImportantData,
              values: data.missingCriticalFieldKeys.isNotEmpty
                  ? data.missingCriticalFieldKeys
                  : data.missingCriticalFields,
            ),
          ] else if (data.missingFields.isNotEmpty) ...[
            const SizedBox(height: 8),
            _FieldList(
              title: context.t.missingData,
              values: data.missingFieldKeys.isNotEmpty
                  ? data.missingFieldKeys
                  : data.missingFields,
            ),
          ],
          if (data.hasSafeguardApplied) ...[
            const SizedBox(height: 8),
            _NoticeRow(
              text: context.t.scoreLimitApplied,
            ),
          ],
          const SizedBox(height: 12),
          Text(
            context.t.tazaScoreDisclosure,
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
              context.t.pick(
                ru: 'Загрузка оценки продукта...',
                kk: 'Өнім бағасы жүктелуде...',
              ),
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
          context.t.productDataUnavailable,
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
          child: Text(context.t.retry),
        ),
      ],
    );
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
          context.t.scoreUnavailable,
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        Text(
          data.missingFields.isEmpty
              ? context.t.pick(
                  ru: 'Недостаточно данных для расчёта.',
                  kk: 'Есептеу үшін деректер жеткіліксіз.',
                )
              : context.t.pick(
                  ru:
                      'Не хватает: ${_localizedFields(context, data.missingFieldKeys.isNotEmpty ? data.missingFieldKeys : data.missingFields).join(', ')}.',
                  kk:
                      'Жетіспейді: ${_localizedFields(context, data.missingFieldKeys.isNotEmpty ? data.missingFieldKeys : data.missingFields).join(', ')}.',
                ),
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 14),
        _InfoRow(
          label: context.t.dataReliability,
          value: _confidenceLabel(context, data.confidence),
        ),
      ],
    );
  }
}

/// Small side-by-side card showing the Nutri-Score A–E scale, with the
/// product's actual grade highlighted.
class _NutriScoreCard extends StatelessWidget {
  const _NutriScoreCard({required this.grade});

  final String? grade;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final gradeLabel = grade?.toUpperCase();

    return TazaSurfaceCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Nutri-Score',
            style: textTheme.labelMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          if (gradeLabel == null)
            Text(
              context.t.unavailableBecausePartial,
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
                height: 1.3,
              ),
            )
          else
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (final letter in const ['A', 'B', 'C', 'D', 'E'])
                  _NutriScoreLetter(
                    letter: letter,
                    isActive: letter == gradeLabel,
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _NutriScoreLetter extends StatelessWidget {
  const _NutriScoreLetter({required this.letter, required this.isActive});

  final String letter;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final color = ProductGradeColors.colorFor(letter);
    final size = isActive ? 32.0 : 20.0;

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: isActive ? color : color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(isActive ? 11 : 7),
        boxShadow: isActive
            ? [
                BoxShadow(
                  color: color.withValues(alpha: 0.38),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ]
            : null,
      ),
      child: Text(
        letter,
        style: TextStyle(
          fontSize: isActive ? 15 : 10,
          fontWeight: isActive ? FontWeight.w900 : FontWeight.w800,
          color: isActive ? Colors.white : color,
        ),
      ),
    );
  }
}

/// Small side-by-side card showing data confidence and coverage — shown
/// exactly once on the screen (not duplicated inside the detailed
/// breakdown).
class _ConfidenceCard extends StatelessWidget {
  const _ConfidenceCard({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final coverage = data.nutritionCoverage;

    return TazaSurfaceCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            context.t.pick(ru: 'Достоверность', kk: 'Сенімділік'),
            style: textTheme.labelMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _confidenceLabel(context, data.confidence),
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          if (coverage != null) ...[
            const SizedBox(height: 2),
            Text(
              _coverageCaption(context, coverage),
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
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

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: colorScheme.outlineVariant, width: 1),
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    context.t.detailsAboutScore,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Icon(
                  expanded
                      ? Icons.keyboard_arrow_up_rounded
                      : Icons.chevron_right_rounded,
                  size: 18,
                  color: colorScheme.primary,
                ),
              ],
            ),
          ),
        ),
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
                    ProductPresentationLocalization.missingField(
                      value,
                      locale: context.tazaLocaleController.locale,
                    ),
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

class _NoticeRow extends StatelessWidget {
  const _NoticeRow({required this.text, this.stronger = false});

  final String text;
  final bool stronger;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
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

Color _scoreColor(int? score) {
  return TazaScoreConsumerPresentation.colorForScore(score);
}

String _scoreInterpretation(BuildContext context, int? score) {
  final t = context.t;
  if (score == null) {
    return t.pick(
      ru: 'Оценка пищевого профиля продукта',
      kk: 'Өнімнің тағамдық профилін бағалау',
    );
  }
  if (score >= 80) {
    return t.pick(
      ru: 'Отличный выбор для регулярного питания.',
      kk: 'Тұрақты тамақтану үшін тамаша таңдау.',
    );
  }
  if (score >= 60) {
    return t.pick(
      ru: 'Хороший вариант, который можно есть регулярно.',
      kk: 'Тұрақты тұтынуға болатын жақсы нұсқа.',
    );
  }
  if (score >= 40) {
    return t.pick(
      ru: 'Нормальный вариант, но не как основа рациона.',
      kk: 'Қалыпты нұсқа, бірақ рационның негізі емес.',
    );
  }
  return t.pick(
    ru: 'Лучше выбирать пореже, а не на каждый день.',
    kk: 'Күн сайын емес, сирек таңдаған дұрыс.',
  );
}

Color _reasonColor(String reason) {
  final normalized = reason.toLowerCase();
  if (normalized.contains('много') ||
      normalized.contains('высок') ||
      normalized.contains('жоғары') ||
      normalized.contains('подсласт')) {
    return const Color(0xFFF59E42);
  }
  if (normalized.contains('низкое содержание соли') ||
      normalized.contains('мөлшері төмен') ||
      normalized.contains('волокн') ||
      normalized.contains('белк')) {
    return const Color(0xFF24C78E);
  }
  return const Color(0xFFA7B4C5);
}

IconData _reasonIcon(String reason, {required bool isNeutral}) {
  if (isNeutral) return Icons.info_outline_rounded;
  final normalized = reason.toLowerCase();
  if (normalized.contains('много') ||
      normalized.contains('высок') ||
      normalized.contains('жоғары') ||
      normalized.contains('подсласт')) {
    return Icons.warning_amber_rounded;
  }
  return Icons.check_circle_outline_rounded;
}

String _confidenceLabel(BuildContext context, TazaScoreConfidence confidence) {
  return switch (confidence) {
    TazaScoreConfidence.high => context.t.confidenceLabel('high'),
    TazaScoreConfidence.medium => context.t.confidenceLabel('medium'),
    TazaScoreConfidence.low => context.t.confidenceLabel('low'),
  };
}

String _coverageLabel(double value) {
  return '${(value * 100).round()}%';
}

String _coverageCaption(BuildContext context, double value) {
  final percent = _coverageLabel(value);
  return context.tazaLocaleController.locale == TazaLocale.kk
      ? '$percent негізгі деректер'
      : '$percent ключевых данных';
}

List<String> _localizedFields(BuildContext context, List<String> values) {
  return values
      .map(
        (value) => ProductPresentationLocalization.missingField(
          value,
          locale: context.tazaLocaleController.locale,
        ),
      )
      .toList();
}
