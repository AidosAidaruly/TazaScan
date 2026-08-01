import 'package:project/src/features/product/domain/entities/product.dart';

class ProductDetailsArgs {
  const ProductDetailsArgs({
    required this.product,
    this.refreshFromNetwork = false,
  });

  final Product product;
  final bool refreshFromNetwork;
}
