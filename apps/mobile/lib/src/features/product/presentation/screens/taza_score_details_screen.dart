import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/presentation/scoring/taza_score_consumer_presentation.dart';
import 'package:project/src/features/product/presentation/widgets/product_presentation_localization.dart';
import 'package:project/src/features/product/presentation/widgets/taza_score_beta_card.dart';

/// The dedicated "Как рассчитан TazaScore" screen, reached from
/// [TazaScoreBetaCard]'s details row. Purely a presentation of the already
/// -calculated [TazaScorePreviewData] passed in — no scoring, sourcing or
/// repository logic lives here.
class TazaScoreDetailsScreen extends StatelessWidget {
  const TazaScoreDetailsScreen({required this.data, super.key});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          context.t.pick(
            ru: 'Как рассчитан TazaScore',
            kk: 'TazaScore қалай есептелді',
          ),
        ),
      ),
      body: ResponsivePage(
        child: ListView(
          children: [
            _SummaryCard(data: data),
            const SizedBox(height: 18),
            _SectionTitle(
              context.t.pick(ru: 'Из чего складывается', kk: 'Неден тұрады'),
            ),
            const SizedBox(height: 10),
            _BreakdownCard(data: data),
            const SizedBox(height: 18),
            _SectionTitle(context.t.scoreReliability),
            const SizedBox(height: 10),
            _ReliabilityCard(data: data),
            const SizedBox(height: 14),
            const _DisclosureNotice(),
          ],
        ),
      ),
    );
  }
}

/// A section heading that sits outside its card, matching the reference —
/// "Из чего складывается" and "Достоверность оценки" are page-level
/// headings, not card titles.
class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(
        context,
      ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
    );
  }
}

/// The visible warm-gray neutral used for unfilled progress-bar track and
/// pill backgrounds. Deliberately opaque and distinct from the card's own
/// white background — an alpha-washed tint here reads as barely-there.
Color _trackColor(ColorScheme colorScheme) {
  return colorScheme.outlineVariant;
}

/// Score + status badge, a two-tone progress bar (nutrition profile vs.
/// composition points out of the total) and a small legend.
class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final score = data.score;
    final color = TazaScoreConsumerPresentation.colorForScore(score);
    final maxScore = data.maxScore > 0 ? data.maxScore : 100;
    final nutritionPoints = (data.nutritionComponent ?? 0).clamp(0, maxScore);
    final ingredientPoints = (data.ingredientComponent ?? 0).clamp(
      0,
      maxScore - nutritionPoints,
    );

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                score?.toString() ?? '—',
                style: textTheme.displayMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  height: 1,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(left: 5, top: 10),
                child: Text(
                  '/ $maxScore',
                  style: textTheme.titleMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Spacer(),
              Flexible(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    child: Text(
                      context.t.scoreCategory(score),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _ContributionBar(
            height: 10,
            total: maxScore,
            segments: [
              (nutritionPoints, _nutritionColor),
              (ingredientPoints, colorScheme.primary),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _LegendDot(color: _nutritionColor),
                  const SizedBox(width: 6),
                  Text(
                    context.t.nutritionProfile,
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _LegendDot(color: colorScheme.primary),
                  const SizedBox(width: 6),
                  Text(
                    context.t.ingredientsAndAdditives,
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

const _nutritionColor = Color(0xFFF59E42);

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}

/// A horizontal bar split into flex-proportioned colored segments plus a
/// visible track for the remainder, built with Row/Expanded(flex:) rather
/// than Stack/FractionallySizedBox.
///
/// The previous Stack-based version placed bare, childless [ColoredBox]es
/// either directly as non-positioned Stack children or inside a
/// [FractionallySizedBox] with only `widthFactor` set. In both cases the
/// *height* constraint stayed loose (0..H); a childless [ColoredBox] under
/// loose constraints sizes itself to `constraints.smallest`, i.e. zero
/// height — so the colored fills had correct width but painted nothing.
/// Here, `Expanded` gives each segment a tight width and
/// `CrossAxisAlignment.stretch` gives it the Row's full tight height, so
/// every segment is always a fully tight box and cannot collapse.
class _ContributionBar extends StatelessWidget {
  const _ContributionBar({
    required this.height,
    required this.total,
    required this.segments,
  });

  final double height;
  final int total;
  final List<(int value, Color color)> segments;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final used = segments.fold<int>(
      0,
      (sum, segment) => sum + (segment.$1 > 0 ? segment.$1 : 0),
    );
    final remainder = total - used;

    return SizedBox(
      height: height,
      width: double.infinity,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final segment in segments)
              if (segment.$1 > 0)
                Expanded(
                  flex: segment.$1,
                  child: ColoredBox(color: segment.$2),
                ),
            Expanded(
              flex: remainder > 0 ? remainder : 1,
              child: ColoredBox(color: _trackColor(colorScheme)),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Из чего складывается": nutrition profile, composition/additives, and
/// the (still unscored) processing-degree row — each reusing the exact
/// existing component point values, nothing recalculated.
class _BreakdownCard extends StatelessWidget {
  const _BreakdownCard({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final t = context.t;

    final rows = <Widget>[
      if (data.nutritionComponent != null)
        _ComponentRow(
          label: t.nutritionProfile,
          points: data.nutritionComponent!,
          max: data.nutritionMax,
          color: _nutritionColor,
          caption: t.pick(
            ru:
                'На основе Nutri-Score V2-2023: сахар снижает балл, белка и клетчатки нет.',
            kk:
                'Nutri-Score V2-2023 негізінде: қант ұпайды төмендетеді, ақуыз бен талшық жоқ.',
          ),
        ),
      if (data.ingredientComponent != null)
        _ComponentRow(
          label: t.ingredientsAndAdditives,
          points: data.ingredientComponent!,
          max: data.ingredientMax,
          color: colorScheme.primary,
          caption: t.pick(
            ru:
                'Добавки учитываются в информационном режиме — баллы не снимаются.',
            kk: 'Қоспалар ақпараттық режимде ескеріледі — ұпай алынбайды.',
          ),
        ),
      const _ProcessingRow(),
    ];

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var index = 0; index < rows.length; index++) ...[
            if (index > 0) const Divider(height: 18),
            rows[index],
          ],
        ],
      ),
    );
  }
}

class _ComponentRow extends StatelessWidget {
  const _ComponentRow({
    required this.label,
    required this.points,
    required this.max,
    required this.color,
    required this.caption,
  });

  final String label;
  final int points;
  final int max;
  final Color color;
  final String caption;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            Text(
              '$points / $max',
              style: textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        _ContributionBar(
          height: 6,
          total: max > 0 ? max : 1,
          segments: [(max > 0 ? points : 0, color)],
        ),
        const SizedBox(height: 6),
        Text(
          caption,
          style: textTheme.bodySmall?.copyWith(
            color: colorScheme.onSurfaceVariant,
            height: 1.3,
          ),
        ),
      ],
    );
  }
}

class _ProcessingRow extends StatelessWidget {
  const _ProcessingRow();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                context.t.processingDegree,
                style: textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                color: _trackColor(colorScheme),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                child: Text(
                  context.t.processingNotScored,
                  style: textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        _StripedBar(color: _trackColor(colorScheme)),
      ],
    );
  }
}

/// A dashed, inactive-looking bar for the not-yet-scored processing-degree
/// row — a row of short evenly-spaced ticks, visually distinct from an
/// active progress fill rather than a flat muted rectangle.
class _StripedBar extends StatelessWidget {
  const _StripedBar({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 8,
      width: double.infinity,
      child: CustomPaint(painter: _StripedBarPainter(color: color)),
    );
  }
}

class _StripedBarPainter extends CustomPainter {
  const _StripedBarPainter({required this.color});

  final Color color;

  static const _dashWidth = 4.0;
  static const _gapWidth = 3.0;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final radius = Radius.circular(size.height / 2);

    var x = 0.0;
    while (x < size.width) {
      final dashEnd = (x + _dashWidth).clamp(0.0, size.width);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTRB(x, 0, dashEnd, size.height),
          radius,
        ),
        paint,
      );
      x += _dashWidth + _gapWidth;
    }
  }

  @override
  bool shouldRepaint(covariant _StripedBarPainter oldDelegate) {
    return color != oldDelegate.color;
  }
}

/// "Достоверность оценки": confidence badge, coverage, and structured
/// reliability rows — plus any missing-data list / safeguard notice the
/// score actually carries, reusing the exact same fields as before.
class _ReliabilityCard extends StatelessWidget {
  const _ReliabilityCard({required this.data});

  final TazaScorePreviewData data;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final t = context.t;
    final coverage = data.nutritionCoverage;

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: colorScheme.primary.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.verified_rounded,
                  color: colorScheme.primary,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tazaScoreConfidenceLabel(context, data.confidence),
                      style: textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (coverage != null)
                      Text(
                        tazaScoreCoverageCaption(context, coverage),
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (coverage != null) ...[
            const SizedBox(height: 8),
            _CoverageSegments(coverage: coverage),
          ],
          const SizedBox(height: 8),
          _InfoRow(
            label: t.pick(ru: 'Питательные данные', kk: 'Тағамдық деректер'),
            value: coverage != null
                ? tazaScoreCoverageLabel(coverage)
                : t.pick(ru: 'Нет данных', kk: 'Деректер жоқ'),
          ),
          _InfoRow(
            label: t.pick(ru: 'Состав', kk: 'Құрамы'),
            value: data.ingredientComponent != null
                ? t.pick(ru: 'Есть', kk: 'Бар')
                : t.pick(ru: 'Нет данных', kk: 'Деректер жоқ'),
          ),
          _InfoRow(label: t.additives, value: t.informationalAnalysis),
          if (data.missingCriticalFields.isNotEmpty) ...[
            const SizedBox(height: 8),
            _FieldList(
              title: t.missingImportantData,
              values: data.missingCriticalFieldKeys.isNotEmpty
                  ? data.missingCriticalFieldKeys
                  : data.missingCriticalFields,
            ),
          ] else if (data.missingFields.isNotEmpty) ...[
            const SizedBox(height: 8),
            _FieldList(
              title: t.missingData,
              values: data.missingFieldKeys.isNotEmpty
                  ? data.missingFieldKeys
                  : data.missingFields,
            ),
          ],
          if (data.hasSafeguardApplied) ...[
            const SizedBox(height: 10),
            _NoticeRow(text: t.scoreLimitApplied),
          ],
        ],
      ),
    );
  }
}

class _CoverageSegments extends StatelessWidget {
  const _CoverageSegments({required this.coverage});

  final double coverage;

  static const _segmentCount = 10;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final filled = (coverage.clamp(0.0, 1.0) * _segmentCount).round();

    return Row(
      children: [
        for (var index = 0; index < _segmentCount; index++) ...[
          if (index > 0) const SizedBox(width: 4),
          Expanded(
            child: Container(
              height: 6,
              decoration: BoxDecoration(
                color: index < filled
                    ? colorScheme.primary
                    : _trackColor(colorScheme),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
        ],
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
      padding: const EdgeInsets.symmetric(vertical: 4),
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
  const _NoticeRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.info_outline_rounded,
          size: 16,
          color: colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w800,
              height: 1.25,
            ),
          ),
        ),
      ],
    );
  }
}

class _DisclosureNotice extends StatelessWidget {
  const _DisclosureNotice();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.info_outline_rounded,
              size: 18,
              color: colorScheme.primary,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                context.t.tazaScoreDisclosure,
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
