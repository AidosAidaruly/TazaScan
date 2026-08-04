import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class CachedProductSummary {
  const CachedProductSummary({
    required this.id,
    required this.barcode,
    required this.name,
    required this.calculatedScore,
    required this.createdAt,
    required this.updatedAt,
    this.brand,
    this.category,
    this.imageUrl,
    this.grade,
  });

  factory CachedProductSummary.fromProduct(Product product) {
    return CachedProductSummary(
      id: product.id,
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      category: product.category,
      imageUrl: product.imageUrl,
      calculatedScore: product.nutritionScore.score ?? product.healthScore,
      grade: product.nutritionScore.grade,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    );
  }

  final String id;
  final String barcode;
  final String name;
  final String? brand;
  final String? category;
  final String? imageUrl;
  final int calculatedScore;
  final String? grade;
  final DateTime createdAt;
  final DateTime updatedAt;

  Product toCachedProduct() {
    return Product(
      id: id,
      barcode: barcode,
      name: name,
      brand: brand,
      category: category,
      imageUrl: imageUrl,
      ingredients: const [],
      nutritionFacts: const {},
      healthScore: calculatedScore,
      nutritionScore: NutritionScore(
        score: calculatedScore,
        grade: grade,
        status: 'offline_cached',
        positiveReasons: const [],
        negativeReasons: const [],
        warnings: const [
          'Офлайн-данные. Подключись к интернету, чтобы обновить детали.',
        ],
        missingFields: const [],
        algorithm: 'cached summary',
        algorithmVersion: 'local-1',
        calculatedAt: updatedAt,
      ),
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
