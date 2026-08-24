import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/presentation/widgets/insight_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_presentation_localization.dart';

class NutritionScoreDetailsSection extends StatelessWidget {
  const NutritionScoreDetailsSection({required this.score, super.key});

  final NutritionScore score;

  @override
  Widget build(BuildContext context) {
    final locale = context.tazaLocaleController.locale;
    final positiveItems = score.positiveReasons
        .map((value) => ProductPresentationLocalization.insight(value, locale: locale))
        .toList();
    final attentionItems = [
      ...score.negativeReasons,
      ...score.warnings,
    ].map((value) => ProductPresentationLocalization.insight(value, locale: locale)).toList();
    final missingItems = score.missingFields
        .map((value) => ProductPresentationLocalization.missingField(value, locale: locale))
        .toList();
    final hasInsights =
        positiveItems.isNotEmpty ||
        attentionItems.isNotEmpty ||
        missingItems.isNotEmpty;

    if (!hasInsights) {
      return TazaSurfaceCard(
        padding: const EdgeInsets.all(18),
        child: Text(context.t.noAdditionalNotes),
      );
    }

    return Column(
      children: [
        InsightSection(
          title: context.t.pick(ru: 'Что хорошо', kk: 'Жақсы жақтары'),
          items: positiveItems,
          icon: Icons.check_circle_rounded,
          color: const Color(0xFF24C78E),
        ),
        if (positiveItems.isNotEmpty) const SizedBox(height: 12),
        InsightSection(
          title: context.t.pick(
            ru: 'На что обратить внимание',
            kk: 'Неге назар аудару керек',
          ),
          items: attentionItems,
          icon: Icons.warning_rounded,
          color: const Color(0xFFF59E42),
        ),
        if (attentionItems.isNotEmpty) const SizedBox(height: 12),
        InsightSection(
          title: context.t.missingData,
          items: missingItems,
          icon: Icons.info_rounded,
          color: const Color(0xFFA7B4C5),
        ),
      ],
    );
  }
}
