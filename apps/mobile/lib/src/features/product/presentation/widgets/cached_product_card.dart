import 'package:flutter/material.dart';
import 'package:project/src/core/network/asset_url_resolver.dart';
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
    final imageUrl = resolveApiAssetUrl(product.imageUrl);

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: SizedBox(
            width: 40,
            height: 40,
            child: imageUrl == null
                ? CircleAvatar(
                    child: Text(product.grade ?? '${product.calculatedScore}'),
                  )
                : Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => CircleAvatar(
                      child: Text(
                        product.grade ?? '${product.calculatedScore}',
                      ),
                    ),
                  ),
          ),
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
