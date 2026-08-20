import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/product/data/models/product_model.dart';

void main() {
  test('parses product DTO from API response data', () {
    final product = ProductModel.fromJson({
      'id': 'product-id',
      'barcode': '5449000000996',
      'name': 'Coca-Cola Original Taste',
      'brand': 'Coca-Cola',
      'category': 'Soft Drinks',
      'ingredients': ['Carbonated water', 'Sugar'],
      'nutritionFacts': {'energyKcal': 42, 'sugarsG': 10.6},
      'healthScore': 65,
      'nutritionScore': {
        'score': 65,
        'grade': 'C',
        'status': 'calculated',
        'positiveReasons': ['Low saturated fat.'],
        'negativeReasons': ['High sugar content.'],
        'warnings': [],
        'missingFields': [],
        'algorithm': 'Nutri-Score nutritional foundation',
        'algorithmVersion': 'nutri-score-foundation-2025-01',
        'calculatedAt': '2026-07-31T00:00:00.000Z',
      },
      'tazaScore': {
        'score': 27,
        'status': 'calculated',
        'nutritionComponent': {
          'score': 17,
          'maxScore': 90,
        },
        'ingredientComponent': {
          'score': 10,
          'maxScore': 10,
        },
        'confidence': {
          'level': 'high',
        },
        'officialNutriScore': {
          'status': 'calculated',
          'rawScore': 14,
          'grade': 'E',
        },
        'reasonCodes': ['HIGH_SUGAR'],
        'negativeReasons': ['High sugar content.'],
        'positiveReasons': [],
        'warnings': [],
        'missingFields': [],
        'missingCriticalFields': [],
        'nutritionCoverage': 1,
        'scoreBeforeSafeguard': 27,
        'scoreCap': null,
        'safeguardsApplied': [],
        'methodologyVersion': 'taza-score-v1',
      },
      'createdAt': '2026-07-31T00:00:00.000Z',
      'updatedAt': '2026-07-31T00:00:00.000Z',
    });

    expect(product.barcode, '5449000000996');
    expect(product.name, 'Coca-Cola Original Taste');
    expect(product.healthScore, 65);
    expect(product.nutritionScore.grade, 'C');
    expect(product.tazaScore?.score, 27);
    expect(product.tazaScore?.nutriScoreGrade, 'E');
    expect(product.tazaScore?.methodologyVersion, 'taza-score-v1');
    expect(
      product.nutritionScore.negativeReasons,
      contains('High sugar content.'),
    );
    expect(product.ingredients, contains('Sugar'));
    expect(product.nutritionFacts['sugarsG'], 10.6);
  });
}
