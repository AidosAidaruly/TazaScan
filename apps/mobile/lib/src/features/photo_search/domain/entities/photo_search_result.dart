import 'package:project/src/features/product/domain/entities/product.dart';

class PhotoSearchResult {
  const PhotoSearchResult({required this.matches, this.query, this.message});

  final String? query;
  final String? message;
  final List<Product> matches;
}
