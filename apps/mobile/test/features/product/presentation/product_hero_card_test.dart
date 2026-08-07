import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/presentation/widgets/product_grade_colors.dart';
import 'package:project/src/features/product/presentation/widgets/product_hero_card.dart';

import '../../test_product_factory.dart';

void main() {
  testWidgets('shows product image when imageUrl exists', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProductHeroCard(
            product: createTestProduct(
              imageUrl: 'https://example.com/coca-cola.webp',
            ),
          ),
        ),
      ),
    );

    final image = tester.widget<Image>(find.byType(Image));
    expect(
      (image.image as NetworkImage).url,
      'https://example.com/coca-cola.webp',
    );
    expect(image.fit, BoxFit.contain);
  });

  testWidgets('shows package placeholder when imageUrl is missing', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ProductHeroCard(product: createTestProduct())),
      ),
    );

    expect(find.byIcon(Icons.inventory_2_outlined), findsOneWidget);
  });

  test('maps grade colors A-E semantically', () {
    expect(ProductGradeColors.colorFor('A'), const Color(0xFF24C78E));
    expect(ProductGradeColors.colorFor('B'), const Color(0xFF8FD85A));
    expect(ProductGradeColors.colorFor('C'), const Color(0xFFF4C542));
    expect(ProductGradeColors.colorFor('D'), const Color(0xFFF59E42));
    expect(ProductGradeColors.colorFor('E'), const Color(0xFFF45B69));
  });

  testWidgets('shows grade badge', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProductHeroCard(
            product: createTestProduct(
              nutritionScore: NutritionScore(
                score: 82,
                grade: 'A',
                status: 'calculated',
                positiveReasons: const [],
                negativeReasons: const [],
                warnings: const [],
                missingFields: const [],
                algorithm: 'test',
                algorithmVersion: '1',
                calculatedAt: DateTime.parse('2026-08-01T00:00:00.000Z'),
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Оценка A'), findsOneWidget);
  });
}
