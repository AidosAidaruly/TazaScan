import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';

class CachedProductCard extends StatelessWidget {
  const CachedProductCard({
    required this.product,
    required this.onTap,
    this.trailing,
    super.key,
  });

  final CachedProductSummary product;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          child: Text(product.grade ?? '${product.calculatedScore}'),
        ),
        title: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(
          [
            if (product.brand != null) product.brand!,
            product.category ?? product.barcode,
          ].join(' · '),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: trailing ?? const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}
