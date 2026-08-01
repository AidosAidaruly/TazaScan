import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class PhotoSearchMatchCard extends StatelessWidget {
  const PhotoSearchMatchCard({
    required this.product,
    required this.onTap,
    super.key,
  });

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: colorScheme.primaryContainer,
          child: Icon(
            Icons.local_drink_rounded,
            color: colorScheme.onPrimaryContainer,
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
        trailing: const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}
