import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/repositories/product_repository.dart';
import 'package:project/src/features/product/domain/services/product_service.dart';
import 'package:project/src/features/product/presentation/screens/product_details_screen.dart';
import 'package:project/src/features/product/presentation/widgets/expandable_technical_details.dart';
import 'package:project/src/features/product/presentation/widgets/nutrition_score_details_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_nutrition_section.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../test_product_factory.dart';

class FakeProductRepository implements ProductRepository {
  FakeProductRepository(this.product);

  final Product product;

  @override
  Future<Product> findByBarcode(String barcode) async {
    return product;
  }

  @override
  Future<List<Product>> search({
    String? name,
    String? brand,
    String? barcode,
    int pageSize = 20,
  }) async {
    return [product];
  }
}

void main() {
  testWidgets('opens cached product details with offline notice', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final cachedProduct = CachedProductSummary.fromProduct(
      createTestProduct(),
    ).toCachedProduct();

    await _pumpDetails(
      tester,
      cachedProduct,
      refreshFromNetwork: true,
      freshProduct: cachedProduct,
    );

    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
    expect(
      find.text('Офлайн-данные. Мы обновим детали, когда появится интернет.'),
      findsOneWidget,
    );
  });

  testWidgets('refreshes cached product from API when online', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final cachedProduct = CachedProductSummary.fromProduct(
      createTestProduct(name: 'Cached name'),
    ).toCachedProduct();
    final freshProduct = createTestProduct(name: 'Fresh product name');

    await _pumpDetails(
      tester,
      cachedProduct,
      refreshFromNetwork: true,
      freshProduct: freshProduct,
    );
    await tester.pumpAndSettle();

    expect(find.text('Fresh product name'), findsOneWidget);
  });

  testWidgets('renders complete nutrition as consumer cards', (tester) async {
    await _pumpSection(
      tester,
      ProductNutritionSection(product: createTestProduct()),
    );

    expect(find.text('Пищевая ценность'), findsOneWidget);
    expect(find.text('Сахар'), findsOneWidget);
    expect(find.text('10.6 г'), findsWidgets);
    expect(find.text('Высокое содержание'), findsOneWidget);
    expect(find.text('Соль'), findsOneWidget);
    expect(find.text('0 г'), findsWidgets);
  });

  testWidgets(
    'shows missing nutrition as no data without confusing null and zero',
    (tester) async {
      await _pumpSection(
        tester,
        ProductNutritionSection(
          product: createTestProduct(
            nutritionFacts: const {
              'energyKcal': null,
              'sugars': null,
              'fat': 0,
              'salt': 0,
            },
          ),
        ),
      );

      expect(find.text('Нет данных'), findsWidgets);
      expect(find.text('0 г'), findsWidgets);
    },
  );

  testWidgets('hides empty insight sections and shows neutral message', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      NutritionScoreDetailsSection(
        score: _score(
          positiveReasons: const [],
          negativeReasons: const [],
          warnings: const [],
          missingFields: const [],
        ),
      ),
    );

    expect(find.text('Что хорошо'), findsNothing);
    expect(find.text('На что обратить внимание'), findsNothing);
    expect(find.text('Дополнительных замечаний нет.'), findsOneWidget);
  });

  testWidgets('hides warning section when warnings are empty', (tester) async {
    await _pumpSection(
      tester,
      NutritionScoreDetailsSection(
        score: _score(
          positiveReasons: const ['Low salt.'],
          negativeReasons: const [],
          warnings: const [],
          missingFields: const [],
        ),
      ),
    );

    expect(find.text('Что хорошо'), findsOneWidget);
    expect(find.text('На что обратить внимание'), findsNothing);
  });

  testWidgets(
    'technical section is collapsed by default and translates status',
    (tester) async {
      await _pumpSection(
        tester,
        ExpandableTechnicalDetails(score: _score(status: 'requires_review')),
      );

      expect(find.text('Как рассчитана оценка'), findsOneWidget);
      expect(find.text('Требуется проверка'), findsNothing);

      await tester.tap(find.text('Как рассчитана оценка'));
      await tester.pumpAndSettle();

      expect(find.text('Требуется проверка'), findsOneWidget);
      expect(find.text('Nutri-Score nutritional foundation'), findsOneWidget);
    },
  );
}

Future<void> _pumpDetails(
  WidgetTester tester,
  Product product, {
  bool refreshFromNetwork = false,
  Product? freshProduct,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: ProductDetailsScreen(
        product: product,
        refreshFromNetwork: refreshFromNetwork,
        productService: ProductService(
          FakeProductRepository(freshProduct ?? product),
        ),
      ),
    ),
  );
}

Future<void> _pumpSection(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
}

NutritionScore _score({
  String status = 'calculated',
  List<String> positiveReasons = const [],
  List<String> negativeReasons = const ['High sugar content.'],
  List<String> warnings = const [],
  List<String> missingFields = const [],
}) {
  return NutritionScore(
    score: 65,
    grade: 'C',
    status: status,
    positiveReasons: positiveReasons,
    negativeReasons: negativeReasons,
    warnings: warnings,
    missingFields: missingFields,
    algorithm: 'Nutri-Score nutritional foundation',
    algorithmVersion: 'nutri-score-foundation-2025-01',
    calculatedAt: DateTime.parse('2026-08-01T00:00:00.000Z'),
  );
}
