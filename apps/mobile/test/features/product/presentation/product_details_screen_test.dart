import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/repositories/product_repository.dart';
import 'package:project/src/features/product/domain/services/product_service.dart';
import 'package:project/src/features/product/presentation/screens/product_details_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../test_product_factory.dart';

class FakeProductRepository implements ProductRepository {
  FakeProductRepository(this.product);

  final Product product;

  @override
  Future<Product> findByBarcode(String barcode) async {
    return product;
  }
}

void main() {
  testWidgets('opens cached product details with offline notice', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final cachedProduct = CachedProductSummary.fromProduct(
      createTestProduct(),
    ).toCachedProduct();

    await tester.pumpWidget(
      MaterialApp(
        home: ProductDetailsScreen(
          product: cachedProduct,
          refreshFromNetwork: true,
          productService: ProductService(FakeProductRepository(cachedProduct)),
        ),
      ),
    );

    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
    expect(
      find.text('Offline data. We will refresh details when internet is available.'),
      findsOneWidget,
    );
  });

  testWidgets('refreshes cached product from API when online', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final cachedProduct = CachedProductSummary.fromProduct(
      createTestProduct(name: 'Cached name'),
    ).toCachedProduct();
    final freshProduct = createTestProduct(name: 'Fresh product name');

    await tester.pumpWidget(
      MaterialApp(
        home: ProductDetailsScreen(
          product: cachedProduct,
          refreshFromNetwork: true,
          productService: ProductService(FakeProductRepository(freshProduct)),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Fresh product name'), findsOneWidget);
  });
}
