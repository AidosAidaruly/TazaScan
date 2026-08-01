import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

Product createTestProduct({
  String id = 'product-id',
  String barcode = '5449000000996',
  String name = 'Coca-Cola Original Taste',
}) {
  final now = DateTime.parse('2026-08-01T00:00:00.000Z');

  return Product(
    id: id,
    barcode: barcode,
    name: name,
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    imageUrl: null,
    ingredients: const ['Carbonated water', 'Sugar'],
    nutritionFacts: const {'energyKcal': 42, 'sugars': 10.6},
    healthScore: 65,
    nutritionScore: NutritionScore(
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
    ),
    createdAt: now,
    updatedAt: now,
  );
}
