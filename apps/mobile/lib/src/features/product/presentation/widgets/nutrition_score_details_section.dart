import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/presentation/widgets/insight_section.dart';

class NutritionScoreDetailsSection extends StatelessWidget {
  const NutritionScoreDetailsSection({required this.score, super.key});

  final NutritionScore score;

  @override
  Widget build(BuildContext context) {
    final attentionItems = [...score.negativeReasons, ...score.warnings];
    final hasInsights =
        score.positiveReasons.isNotEmpty ||
        attentionItems.isNotEmpty ||
        score.missingFields.isNotEmpty;

    if (!hasInsights) {
      return const TazaSurfaceCard(
        padding: EdgeInsets.all(18),
        child: Text('Дополнительных замечаний нет.'),
      );
    }

    return Column(
      children: [
        InsightSection(
          title: 'Что хорошо',
          items: score.positiveReasons,
          icon: Icons.check_circle_rounded,
          color: const Color(0xFF24C78E),
        ),
        if (score.positiveReasons.isNotEmpty) const SizedBox(height: 12),
        InsightSection(
          title: 'На что обратить внимание',
          items: attentionItems,
          icon: Icons.warning_rounded,
          color: const Color(0xFFF59E42),
        ),
        if (attentionItems.isNotEmpty) const SizedBox(height: 12),
        InsightSection(
          title: 'Недостающие данные',
          items: score.missingFields,
          icon: Icons.info_rounded,
          color: const Color(0xFFA7B4C5),
        ),
      ],
    );
  }
}
