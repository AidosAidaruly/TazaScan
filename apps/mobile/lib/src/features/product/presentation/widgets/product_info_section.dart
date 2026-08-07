import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class ProductInfoSection extends StatefulWidget {
  const ProductInfoSection({required this.product, super.key});

  final Product product;

  @override
  State<ProductInfoSection> createState() => _ProductInfoSectionState();
}

class _ProductInfoSectionState extends State<ProductInfoSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final ingredients = widget.product.ingredients;
    final hasLongList = ingredients.length > 8;
    final visibleIngredients = hasLongList && !_expanded
        ? ingredients.take(8).toList()
        : ingredients;

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Состав',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          if (ingredients.isEmpty)
            Text(
              'Нет данных',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final ingredient in visibleIngredients)
                  _IngredientChip(
                    label: ingredient,
                    highlighted: _isImportantIngredient(ingredient),
                  ),
              ],
            ),
          if (hasLongList) ...[
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => setState(() => _expanded = !_expanded),
              child: Text(_expanded ? 'Свернуть' : 'Показать весь состав'),
            ),
          ],
          const SizedBox(height: 14),
          Text(
            'Информация об аллергенах не указана.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 12),
          SelectableText(
            'Штрихкод: ${widget.product.barcode}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  bool _isImportantIngredient(String value) {
    final lower = value.toLowerCase();
    return lower.contains('sugar') ||
        lower.contains('сахар') ||
        lower.contains('sweetener') ||
        lower.contains('подсласт') ||
        lower.contains('palm oil') ||
        lower.contains('пальм');
  }
}

class _IngredientChip extends StatelessWidget {
  const _IngredientChip({required this.label, required this.highlighted});

  final String label;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final color = highlighted
        ? const Color(0xFFF59E42)
        : Theme.of(context).colorScheme.onSurfaceVariant;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: highlighted ? 0.16 : 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
