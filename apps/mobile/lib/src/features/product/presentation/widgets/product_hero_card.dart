import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class ProductHeroCard extends StatelessWidget {
  const ProductHeroCard({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 190,
          width: double.infinity,
          decoration: BoxDecoration(
            color: colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(28),
          ),
          child: Icon(
            Icons.inventory_2_outlined,
            size: 72,
            color: colorScheme.primary,
          ),
        ),
        const SizedBox(height: 20),
        Text(
          product.name,
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        Text(
          [product.brand, product.category].whereType<String>().join(' • '),
          style: Theme.of(
            context,
          ).textTheme.bodyLarge?.copyWith(color: colorScheme.onSurfaceVariant),
        ),
      ],
    );
  }
}
