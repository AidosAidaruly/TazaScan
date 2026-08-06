import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class ProductModel extends Product {
  const ProductModel({
    required super.id,
    required super.barcode,
    required super.name,
    required super.ingredients,
    required super.nutritionFacts,
    required super.healthScore,
    required super.nutritionScore,
    required super.createdAt,
    required super.updatedAt,
    required super.dataStatus,
    super.brand,
    super.category,
    super.imageUrl,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id'] as String,
      barcode: json['barcode'] as String,
      name: json['name'] as String,
      brand: json['brand'] as String?,
      category: json['category'] as String?,
      imageUrl: json['imageUrl'] as String?,
      ingredients: List<String>.from(json['ingredients'] as List),
      nutritionFacts: Map<String, dynamic>.from(json['nutritionFacts'] as Map),
      healthScore: json['healthScore'] as int,
      nutritionScore: NutritionScoreModel.fromJson(
        Map<String, dynamic>.from(json['nutritionScore'] as Map? ?? {}),
        fallbackScore: json['healthScore'] as int,
        fallbackDate: json['updatedAt'] as String,
      ),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      dataStatus: json['dataStatus'] as String? ?? 'unverified',
    );
  }
}

class NutritionScoreModel extends NutritionScore {
  NutritionScoreModel.fromJson(
    Map<String, dynamic> json, {
    required int fallbackScore,
    required String fallbackDate,
  }) : super(
         score: json['score'] as int? ?? fallbackScore,
         grade: json['grade'] as String?,
         status: json['status'] as String? ?? 'insufficient_data',
         positiveReasons: _stringList(json['positiveReasons']),
         negativeReasons: _stringList(json['negativeReasons']),
         warnings: _stringList(json['warnings']),
         missingFields: _stringList(json['missingFields']),
         algorithm: json['algorithm'] as String? ?? 'unknown',
         algorithmVersion: json['algorithmVersion'] as String? ?? 'unknown',
         calculatedAt: DateTime.parse(
           json['calculatedAt'] as String? ?? fallbackDate,
         ),
       );

  static List<String> _stringList(Object? value) {
    if (value is List) {
      return value.map((item) => item.toString()).toList();
    }

    return const [];
  }
}
