import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';

class Product {
  const Product({
    required this.id,
    required this.barcode,
    required this.name,
    required this.ingredients,
    required this.nutritionFacts,
    required this.healthScore,
    required this.nutritionScore,
    required this.createdAt,
    required this.updatedAt,
    this.tazaScore,
    this.dataStatus = 'unverified',
    this.brand,
    this.category,
    this.imageUrl,
  });

  final String id;
  final String barcode;
  final String name;
  final String? brand;
  final String? category;
  final String? imageUrl;
  final String dataStatus;
  final List<String> ingredients;
  final Map<String, dynamic> nutritionFacts;
  final int healthScore;
  final NutritionScore nutritionScore;
  final TazaScorePreviewData? tazaScore;
  final DateTime createdAt;
  final DateTime updatedAt;
}
