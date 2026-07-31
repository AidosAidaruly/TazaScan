import 'package:project/src/features/product/domain/entities/product.dart';

class ProductModel extends Product {
  const ProductModel({
    required super.id,
    required super.barcode,
    required super.name,
    required super.ingredients,
    required super.nutritionFacts,
    required super.healthScore,
    required super.createdAt,
    required super.updatedAt,
    super.brand,
    super.category,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id'] as String,
      barcode: json['barcode'] as String,
      name: json['name'] as String,
      brand: json['brand'] as String?,
      category: json['category'] as String?,
      ingredients: List<String>.from(json['ingredients'] as List),
      nutritionFacts: Map<String, dynamic>.from(json['nutritionFacts'] as Map),
      healthScore: json['healthScore'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}
