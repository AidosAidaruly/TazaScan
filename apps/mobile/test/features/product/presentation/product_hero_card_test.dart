import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
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
}
