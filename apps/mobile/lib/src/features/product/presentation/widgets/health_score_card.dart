import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';

class HealthScoreCard extends StatelessWidget {
  const HealthScoreCard({required this.nutritionScore, super.key});

  final NutritionScore nutritionScore;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          _ScoreBadge(score: nutritionScore.score, grade: nutritionScore.grade),
          const SizedBox(width: 14),
          Expanded(child: _ScoreSummary(nutritionScore: nutritionScore)),
        ],
      ),
    );
  }
}

class _ScoreBadge extends StatelessWidget {
  const _ScoreBadge({required this.score, required this.grade});

  final int? score;
  final String? grade;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        Text(
          grade ?? '-',
          style: Theme.of(context).textTheme.displaySmall?.copyWith(
            color: colorScheme.onPrimaryContainer,
            fontWeight: FontWeight.w900,
          ),
        ),
        Text(
          score == null ? 'No score' : '$score/100',
          style: TextStyle(color: colorScheme.onPrimaryContainer),
        ),
      ],
    );
  }
}

class _ScoreSummary extends StatelessWidget {
  const _ScoreSummary({required this.nutritionScore});

  final NutritionScore nutritionScore;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onPrimaryContainer;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Nutrition Score',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: color,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        Text('Status: ${nutritionScore.status}', style: TextStyle(color: color)),
        Text(
          '${nutritionScore.algorithm} - ${nutritionScore.algorithmVersion}',
          style: TextStyle(color: color),
        ),
      ],
    );
  }
}
