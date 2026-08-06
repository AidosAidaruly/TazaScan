import 'package:flutter/material.dart';
import 'package:project/src/core/network/asset_url_resolver.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class ProductHeroCard extends StatelessWidget {
  const ProductHeroCard({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final imageUrl = resolveApiAssetUrl(product.imageUrl);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: Container(
            height: 190,
            width: double.infinity,
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest,
            ),
            child: imageUrl == null
                ? Icon(
                    Icons.inventory_2_outlined,
                    size: 72,
                    color: colorScheme.primary,
                  )
                : Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Icon(
                      Icons.inventory_2_outlined,
                      size: 72,
                      color: colorScheme.primary,
                    ),
                  ),
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
