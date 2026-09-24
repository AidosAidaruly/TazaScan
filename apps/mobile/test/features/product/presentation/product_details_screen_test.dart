import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/domain/repositories/product_repository.dart';
import 'package:project/src/features/product/domain/services/product_service.dart';
import 'package:project/src/features/product/presentation/screens/product_details_screen.dart';
import 'package:project/src/features/product/presentation/widgets/expandable_technical_details.dart';
import 'package:project/src/features/product/presentation/widgets/ingredient_explanation_row.dart';
import 'package:project/src/features/product/presentation/widgets/nutrition_score_details_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_data_reliability_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_info_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_nutrition_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_score_summary_card.dart';
import 'package:project/src/features/product/presentation/widgets/taza_score_beta_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../test_product_factory.dart';

const testTazaScorePreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 27,
  nutritionComponent: 17,
  ingredientComponent: 10,
  nutriScoreGrade: 'E',
  confidence: TazaScoreConfidence.high,
  reasonLabels: ['Высокое содержание сахара'],
  methodologyVersion: 'taza-score-v1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

class FakeProductRepository implements ProductRepository {
  FakeProductRepository(this.product);

  final Product product;
  int previewRequestCount = 0;
  Object? previewError;
  TazaScorePreviewData previewData = testTazaScorePreview;

  @override
  Future<Product> findByBarcode(String barcode) async {
    return product;
  }

  @override
  Future<TazaScorePreviewData> previewScore(String productId) async {
    previewRequestCount += 1;
    final error = previewError;
    if (error != null) {
      throw error;
    }

    return previewData;
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

  testWidgets('legacy score UI remains available when TazaScore is disabled', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});

    await _pumpDetails(
      tester,
      createTestProduct(),
      enableTazaScorePreview: false,
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -320));
    await tester.pumpAndSettle();

    expect(find.byType(ProductScoreSummaryCard), findsOneWidget);
    expect(find.byType(TazaScoreBetaCard), findsNothing);
    expect(find.text('TazaScore'), findsNothing);
  });

  testWidgets(
    'beta preview renders consumer TazaScore without legacy details',
    (tester) async {
      SharedPreferences.setMockInitialValues({});

      await _pumpDetails(
        tester,
        createTestProduct(nutritionScore: _score(score: 69, grade: 'C')),
        enableTazaScorePreview: true,
      );
      await tester.pumpAndSettle();

      expect(find.byType(TazaScoreBetaCard), findsOneWidget);
      expect(find.byType(ProductScoreSummaryCard), findsNothing);
      expect(find.text('TazaScore'), findsOneWidget);
      expect(find.text('27'), findsOneWidget);
      expect(find.text('Nutri-Score'), findsOneWidget);
      expect(find.text('E'), findsOneWidget);
      expect(find.text('69/100 + C'), findsNothing);
      expect(find.text('Legacy'), findsNothing);
    },
  );

  testWidgets('beta flag enabled fetches real preview once', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final repository = FakeProductRepository(createTestProduct());

    await _pumpDetails(
      tester,
      createTestProduct(),
      repository: repository,
      enableTazaScorePreview: true,
    );
    await tester.pumpAndSettle();

    expect(repository.previewRequestCount, 1);
    expect(find.text('27'), findsOneWidget);
  });

  testWidgets('beta flag disabled does not request score preview', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final repository = FakeProductRepository(createTestProduct());

    await _pumpDetails(
      tester,
      createTestProduct(),
      repository: repository,
      enableTazaScorePreview: false,
    );
    await tester.pumpAndSettle();

    expect(repository.previewRequestCount, 0);
    expect(find.byType(TazaScoreBetaCard), findsNothing);
  });

  testWidgets('beta preview shows network error and retries', (tester) async {
    tester.view.physicalSize = const Size(800, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({});
    final repository = FakeProductRepository(createTestProduct())
      ..previewError = const ServerException('Сервер недоступен.');

    await _pumpDetails(
      tester,
      createTestProduct(),
      repository: repository,
      enableTazaScorePreview: true,
    );
    await tester.pumpAndSettle();

    expect(find.text('Не удалось загрузить данные продукта.'), findsOneWidget);
    expect(repository.previewRequestCount, 1);

    repository.previewError = null;
    await tester.tap(find.text('Повторить'));
    await tester.pumpAndSettle();

    expect(repository.previewRequestCount, 2);
    expect(find.text('27'), findsOneWidget);
  });

  testWidgets('renders complete nutrition as consumer cards', (tester) async {
    await _pumpSection(
      tester,
      ProductNutritionSection(product: createTestProduct()),
    );

    expect(find.text('Пищевая ценность'), findsOneWidget);
    expect(find.text('Сахара'), findsOneWidget);
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

  testWidgets('translates high sugar insight and hides raw English reason', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      NutritionScoreDetailsSection(
        score: _score(negativeReasons: const ['High sugar content.']),
      ),
    );

    expect(find.text('Высокое содержание сахара'), findsOneWidget);
    expect(find.text('High sugar content.'), findsNothing);
  });

  testWidgets('shows complete ingredient list in original order', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(
          ingredients: const [
            'Carbonated water',
            'Sugar',
            'Colour caramel E150d',
            'Phosphoric acid',
            'Natural flavourings',
            'Caffeine',
          ],
        ),
      ),
    );

    expect(
      find.textContaining(
        'Газированная вода, Сахар, Карамельный краситель E150d, '
        'Фосфорная кислота (E338), Натуральные ароматизаторы, Кофеин.',
      ),
      findsOneWidget,
    );
    expect(find.text('6 ингредиентов'), findsOneWidget);
  });

  testWidgets('shows dynamic ingredient summary', (tester) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(
          ingredients: const ['Sugar', 'Caffeine', 'E150d', 'E338'],
          nutritionFacts: const {'sugars': 10.6},
        ),
      ),
    );

    expect(find.text('Кратко о составе'), findsOneWidget);
    expect(
      find.textContaining(
        'Содержит добавленный сахар, содержит кофеин и обнаружено 2 пищевые добавки.',
      ),
      findsOneWidget,
    );
    expect(
      find.textContaining('Информация об аллергенах не указана.'),
      findsWidgets,
    );
  });

  testWidgets('shows sugar and caffeine explanations', (tester) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(
          ingredients: const ['Sugar', 'Caffeine'],
          nutritionFacts: const {'sugars': 10.6},
        ),
      ),
    );

    expect(find.text('Источник добавленных сахаров.'), findsOneWidget);
    expect(
      find.text('Высокое содержание сахара учитывается в пищевой оценке.'),
      findsOneWidget,
    );
    expect(
      find.text(
        'Стимулирующее вещество, естественно присутствующее или добавляемое в некоторые напитки.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('Содержит добавленный сахар'), findsOneWidget);
    expect(find.textContaining('содержит кофеин'), findsOneWidget);
  });

  testWidgets('handles additive pluralization for 1, 2 and 5 additives', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(ingredients: const ['E150d']),
      ),
    );
    expect(
      find.textContaining('Обнаружена 1 пищевая добавка.'),
      findsOneWidget,
    );

    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(ingredients: const ['E150d', 'E338']),
      ),
    );
    expect(
      find.textContaining('Обнаружено 2 пищевые добавки.'),
      findsOneWidget,
    );

    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(
          ingredients: const ['E150d', 'E338', 'E330', 'E202', 'E211'],
        ),
      ),
    );
    expect(
      find.textContaining('Обнаружено 5 пищевых добавок.'),
      findsOneWidget,
    );
  });

  testWidgets('shows neutral E150d and E338 additive mapping', (tester) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(
          ingredients: const ['Colour caramel E150d', 'E338'],
        ),
      ),
    );

    expect(find.text('Карамельный краситель E150d'), findsWidgets);
    expect(find.text('Фосфорная кислота (E338)'), findsWidgets);
    expect(find.text('Пищевой краситель.'), findsOneWidget);
    expect(find.text('Регулятор кислотности.'), findsOneWidget);
    expect(find.textContaining('E150d', findRichText: true), findsWidgets);
    expect(find.textContaining('E338', findRichText: true), findsWidgets);
    expect(find.textContaining('опас'), findsNothing);
  });

  testWidgets('unknown ingredient falls back without invented explanation', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(ingredients: const ['Mystery extract']),
      ),
    );

    expect(find.textContaining('Mystery extract'), findsOneWidget);
    expect(find.text('Что в составе'), findsNothing);
    expect(find.textContaining('Источник'), findsNothing);
    expect(find.textContaining('Регулятор'), findsNothing);
  });

  testWidgets('E-number is not automatically treated as danger', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(ingredients: const ['E150d']),
      ),
    );

    final additiveIcon = tester.widget<Icon>(
      find.byIcon(Icons.science_rounded),
    );
    expect(additiveIcon.color, const Color(0xFF1677FF));
    expect(find.textContaining('опас'), findsNothing);
  });

  testWidgets('shows allergen unavailable message', (tester) async {
    await _pumpSection(
      tester,
      ProductInfoSection(product: createTestProduct()),
    );

    expect(find.text('Аллергены'), findsOneWidget);
    expect(
      find.textContaining('При аллергии всегда проверяйте упаковку продукта.'),
      findsOneWidget,
    );
    expect(
      find.textContaining('Информация об аллергенах не указана.'),
      findsWidgets,
    );
  });

  testWidgets('shows missing ingredient list message', (tester) async {
    await _pumpSection(
      tester,
      ProductInfoSection(product: createTestProduct(ingredients: const [])),
    );

    expect(find.text('Состав не указан'), findsOneWidget);
    expect(find.text('Что в составе'), findsNothing);
  });

  testWidgets('long ingredient list can expand and collapse', (tester) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(
          ingredients: const [
            'Ingredient 1',
            'Ingredient 2',
            'Ingredient 3',
            'Ingredient 4',
            'Ingredient 5',
            'Ingredient 6',
            'Ingredient 7',
            'Ingredient 8',
            'Ingredient 9',
            'Ingredient 10',
            'Ingredient 11',
            'Ingredient 12',
          ],
        ),
      ),
    );

    expect(find.text('Показать полностью'), findsOneWidget);
    expect(find.textContaining('Ingredient 11'), findsNothing);

    await tester.tap(find.text('Показать полностью'));
    await tester.pumpAndSettle();

    expect(find.text('Скрыть'), findsOneWidget);
    expect(find.textContaining('Ingredient 11'), findsOneWidget);
  });

  testWidgets('shows maximum five explanation rows before expanding', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(
          ingredients: const [
            'Carbonated water',
            'Natural flavourings',
            'E150d',
            'E338',
            'Caffeine',
            'Sugar',
          ],
          nutritionFacts: const {'sugars': 10.6},
        ),
      ),
    );

    expect(find.byType(IngredientExplanationRow), findsNWidgets(5));
    expect(find.text('Показать все'), findsOneWidget);
    expect(find.text('Источник добавленных сахаров.'), findsOneWidget);
    expect(
      find.text('Используются для формирования вкуса и аромата продукта.'),
      findsNothing,
    );

    await tester.ensureVisible(find.text('Показать все'));
    await tester.tap(find.text('Показать все'));
    await tester.pumpAndSettle();

    expect(find.byType(IngredientExplanationRow), findsNWidgets(6));
    expect(find.text('Скрыть'), findsOneWidget);

    await tester.ensureVisible(find.text('Скрыть'));
    await tester.tap(find.text('Скрыть'));
    await tester.pumpAndSettle();

    expect(find.byType(IngredientExplanationRow), findsNWidgets(5));
  });

  testWidgets('shows automatic translation note for ingredients', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ProductInfoSection(
        product: createTestProduct(ingredientsIsTranslated: true),
      ),
    );

    expect(find.text('Переведено автоматически'), findsOneWidget);
  });

  testWidgets('shows product data source and status without canonical ids', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ProductDataReliabilitySection(
        product: createTestProduct(
          dataStatus: 'community',
          source: 'Open Food Facts',
          scoreSource: 'canonical_recipe',
        ),
      ),
    );

    expect(find.text('Данные продукта'), findsOneWidget);
    expect(find.text('Open Food Facts'), findsOneWidget);
    expect(find.text('Данные сообщества'), findsOneWidget);
    expect(find.textContaining('подтверждённой рецептуре'), findsOneWidget);
    expect(find.textContaining('canonical'), findsNothing);
  });

  testWidgets('barcode is not displayed inside ingredients section', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ProductInfoSection(product: createTestProduct(barcode: '5449000000996')),
    );

    expect(find.textContaining('Штрихкод'), findsNothing);
    expect(find.textContaining('5449000000996'), findsNothing);
  });

  testWidgets('uses green for low saturated fat and warning for low fiber', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ProductNutritionSection(
        product: createTestProduct(
          nutritionFacts: const {
            'energyKcal': 42,
            'protein': 0,
            'carbohydrates': 10.6,
            'sugars': 10.6,
            'fat': 0,
            'saturatedFat': 0,
            'fiber': 0,
            'salt': 0,
          },
        ),
      ),
    );

    final saturatedFatIcon = tester.widget<Icon>(
      find.byIcon(Icons.opacity_rounded),
    );
    final fiberIcon = tester.widget<Icon>(find.byIcon(Icons.spa_rounded));

    expect(saturatedFatIcon.color, const Color(0xFF24C78E));
    expect(fiberIcon.color, const Color(0xFFF4C542));
  });

  testWidgets(
    'technical section is collapsed by default and translates status',
    (tester) async {
      await _pumpSection(
        tester,
        ExpandableTechnicalDetails(
          score: _score(status: 'requires_review'),
          barcode: '5449000000996',
        ),
      );

      expect(find.text('Как рассчитана оценка'), findsOneWidget);
      expect(find.text('Требуется проверка'), findsNothing);

      await tester.tap(find.text('Как рассчитана оценка'));
      await tester.pumpAndSettle();

      expect(find.text('Требуется проверка'), findsOneWidget);
      expect(find.text('Nutri-Score nutritional foundation'), findsOneWidget);
      expect(find.text('Штрихкод'), findsOneWidget);
      expect(find.text('5449000000996'), findsOneWidget);
    },
  );

  testWidgets('shows safe fallback for unknown technical status', (
    tester,
  ) async {
    await _pumpSection(
      tester,
      ExpandableTechnicalDetails(score: _score(status: 'unknown_status_code')),
    );

    await tester.tap(find.text('Как рассчитана оценка'));
    await tester.pumpAndSettle();

    expect(find.text('Неизвестно'), findsOneWidget);
    expect(find.text('unknown_status_code'), findsNothing);
  });
}

Future<void> _pumpDetails(
  WidgetTester tester,
  Product product, {
  bool refreshFromNetwork = false,
  Product? freshProduct,
  FakeProductRepository? repository,
  bool enableTazaScorePreview = true,
}) async {
  final productRepository =
      repository ?? FakeProductRepository(freshProduct ?? product);

  await tester.pumpWidget(
    MaterialApp(
      home: ProductDetailsScreen(
        product: product,
        refreshFromNetwork: refreshFromNetwork,
        productService: ProductService(productRepository),
        enableTazaScorePreview: enableTazaScorePreview,
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
  int? score = 65,
  String? grade = 'C',
  String status = 'calculated',
  List<String> positiveReasons = const [],
  List<String> negativeReasons = const ['High sugar content.'],
  List<String> warnings = const [],
  List<String> missingFields = const [],
}) {
  return NutritionScore(
    score: score,
    grade: grade,
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
