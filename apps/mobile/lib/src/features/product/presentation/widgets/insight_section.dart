import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';

class InsightSection extends StatelessWidget {
  const InsightSection({
    required this.title,
    required this.items,
    required this.icon,
    required this.color,
    super.key,
  });

  final String title;
  final List<String> items;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 21),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (final item in items) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 7),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: const SizedBox(width: 5, height: 5),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(item)),
              ],
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}
