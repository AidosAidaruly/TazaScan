import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';

Product createTestProduct({
  String id = 'product-id',
  String barcode = '5449000000996',
  String name = 'Coca-Cola Original Taste',
  String? imageUrl,
  Map<String, dynamic> nutritionFacts = const {
    'energyKcal': 42,
    'protein': 0,
    'carbohydrates': 10.6,
    'sugars': 10.6,
    'fat': 0,
    'saturatedFat': 0,
    'fiber': null,
    'salt': 0,
  },
  List<String> ingredients = const ['Carbonated water', 'Sugar'],
  NutritionScore? nutritionScore,
  TazaScorePreviewData? tazaScore,
}) {
  final now = DateTime.parse('2026-08-01T00:00:00.000Z');
  final score =
      nutritionScore ??
      NutritionScore(
        score: 65,
        grade: 'C',
        status: 'calculated',
        positiveReasons: const [],
        negativeReasons: const ['High sugar content.'],
        warnings: const [],
        missingFields: const [],
        algorithm: 'Nutri-Score nutritional foundation',
        algorithmVersion: 'nutri-score-foundation-2025-01',
        calculatedAt: now,
      );

  return Product(
    id: id,
    barcode: barcode,
    name: name,
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    imageUrl: imageUrl,
    ingredients: ingredients,
    nutritionFacts: nutritionFacts,
    healthScore: score.score ?? 0,
    nutritionScore: score,
    tazaScore: tazaScore,
    createdAt: now,
    updatedAt: now,
  );
}
