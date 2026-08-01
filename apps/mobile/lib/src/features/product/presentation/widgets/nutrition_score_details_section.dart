import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';

class NutritionScoreDetailsSection extends StatelessWidget {
  const NutritionScoreDetailsSection({required this.score, super.key});

  final NutritionScore score;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Score explanation',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          _ReasonList(title: 'Positive', items: score.positiveReasons),
          _ReasonList(title: 'Negative', items: score.negativeReasons),
          _ReasonList(title: 'Warnings', items: score.warnings),
          _ReasonList(title: 'Missing data', items: score.missingFields),
          const SizedBox(height: 12),
          const Text(
            'This nutrition score is informational only and is not medical advice.',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _ReasonList extends StatelessWidget {
  const _ReasonList({required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final displayItems = items.isEmpty ? ['None'] : items;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          for (final item in displayItems) Text('• $item'),
        ],
      ),
    );
  }
}
