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
      'createdAt': '2026-07-31T00:00:00.000Z',
      'updatedAt': '2026-07-31T00:00:00.000Z',
    });

    expect(product.barcode, '5449000000996');
    expect(product.name, 'Coca-Cola Original Taste');
    expect(product.healthScore, 65);
    expect(product.ingredients, contains('Sugar'));
    expect(product.nutritionFacts['sugarsG'], 10.6);
  });
}
