import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/network/asset_url_resolver.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';
import 'package:project/src/features/product/domain/entities/halal_check.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/presentation/scoring/taza_score_consumer_presentation.dart';
import 'package:project/src/features/product/presentation/widgets/product_presentation_localization.dart';

class ConsumerProductCard extends StatelessWidget {
  const ConsumerProductCard({
    required this.name,
    required this.onTap,
    this.brand,
    this.category,
    this.imageUrl,
    this.tazaScore,
    this.halalCheck,
    this.cachedScoreLabel,
    this.cachedScore,
    this.trailing,
    super.key,
  });

  factory ConsumerProductCard.fromProduct({
    required Product product,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return ConsumerProductCard(
      name: product.name,
      brand: product.brand,
      category: product.category,
      imageUrl: product.imageUrl,
      tazaScore: product.tazaScore,
      halalCheck: product.halalCheck,
      onTap: onTap,
      trailing: trailing,
    );
  }

  factory ConsumerProductCard.fromCached({
    required CachedProductSummary product,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return ConsumerProductCard(
      name: product.name,
      brand: product.brand,
      category: product.category,
      imageUrl: product.imageUrl,
      cachedScoreLabel: product.scoreLabel,
      cachedScore: product.calculatedScore,
      onTap: onTap,
      trailing: trailing,
    );
  }

  final String name;
  final String? brand;
  final String? category;
  final String? imageUrl;
  final TazaScorePreviewData? tazaScore;
  final HalalCheck? halalCheck;
  final String? cachedScoreLabel;
  final int? cachedScore;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final score = tazaScore?.score ?? _scoreFromCachedLabel(cachedScoreLabel);
    final scoreColor = TazaScoreConsumerPresentation.colorForScore(score);
    final locale = context.tazaLocaleController.locale;
    final localizedCategory = ProductPresentationLocalization.category(
      category,
      locale: locale,
    );
    final subtitleParts = [
      if ((brand ?? '').trim().isNotEmpty) brand!.trim(),
      if (localizedCategory.trim().isNotEmpty) localizedCategory.trim(),
    ];

    return TazaCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _ConsumerProductImage(imageUrl: imageUrl),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    height: 1.12,
                  ),
                ),
                if (subtitleParts.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    subtitleParts.join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _ScorePill(
                      label: _scoreLabel(context, score),
                      color: scoreColor,
                    ),
                    if (TazaScoreConsumerPresentation.shouldShowIncompleteHint(
                      tazaScore,
                    ))
                      _SubtlePill(
                        label: context.t.pick(
                          ru: 'Неполные данные',
                          kk: 'Деректер толық емес',
                        ),
                      ),
                    if (halalCheck != null)
                      _HalalPill(halalCheck: halalCheck!),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          trailing ??
              Icon(
                Icons.chevron_right_rounded,
                size: 22,
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.82),
              ),
        ],
      ),
    );
  }

  String _scoreLabel(BuildContext context, int? score) {
    if (score == null ||
        tazaScore?.status == TazaScorePreviewStatus.insufficientData) {
      return 'TazaScore · ${context.t.noData.toLowerCase()}';
    }

    return 'TazaScore $score/100 · ${context.t.scoreCategory(score)}';
  }

  int? _scoreFromCachedLabel(String? label) {
    if (label == null ||
        label.contains('нет данных') ||
        label.contains('деректер жоқ')) {
      return null;
    }

    final match = RegExp(r'(\d+)').firstMatch(label);
    if (match == null) {
      return cachedScore == null || cachedScore == 0 ? null : cachedScore;
    }

    return int.tryParse(match.group(1)!);
  }
}

class _HalalPill extends StatelessWidget {
  const _HalalPill({required this.halalCheck});

  final HalalCheck halalCheck;

  @override
  Widget build(BuildContext context) {
    final color = switch (halalCheck.status) {
      HalalCheckStatus.halalConfirmed => const Color(0xFF24C78E),
      HalalCheckStatus.screeningClear => const Color(0xFF7FB2D9),
      HalalCheckStatus.nonHalal => const Color(0xFFF45B69),
      HalalCheckStatus.reviewRequired => const Color(0xFFF59E42),
      HalalCheckStatus.insufficientData => const Color(0xFFA7B4C5),
    };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          '${context.t.halalCheck} · ${context.t.halalBadgeLabel(halalCheck.status)}',
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w900,
            height: 1,
          ),
        ),
      ),
    );
  }
}

class _ConsumerProductImage extends StatelessWidget {
  const _ConsumerProductImage({required this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final resolvedImageUrl = resolveApiAssetUrl(imageUrl);

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 72,
        height: 72,
        child: resolvedImageUrl == null
            ? _Placeholder(colorScheme: colorScheme)
            : Image.network(
                resolvedImageUrl,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) =>
                    _Placeholder(colorScheme: colorScheme),
              ),
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.colorScheme});

  final ColorScheme colorScheme;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: colorScheme.primary.withValues(alpha: 0.1),
      child: Icon(
        Icons.inventory_2_outlined,
        color: colorScheme.primary,
      ),
    );
  }
}

class _ScorePill extends StatelessWidget {
  const _ScorePill({required this.label, required this.color});

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
            height: 1,
          ),
        ),
      ),
    );
  }
}

class _SubtlePill extends StatelessWidget {
  const _SubtlePill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surface.withValues(alpha: 0.46),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        child: Text(
          label,
          style: TextStyle(
            color: colorScheme.onSurfaceVariant,
            fontSize: 12,
            fontWeight: FontWeight.w800,
            height: 1,
          ),
        ),
      ),
    );
  }
}
