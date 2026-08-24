import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/presentation/widgets/consumer_product_card.dart';

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
    return ConsumerProductCard.fromProduct(product: product, onTap: onTap);
  }
}
