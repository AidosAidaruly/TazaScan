import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/domain/repositories/product_repository.dart';
import 'package:project/src/features/product/domain/services/product_service.dart';
import 'package:project/src/features/product_search/presentation/screens/product_search_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../test_product_factory.dart';

class FakeSearchRepository implements ProductRepository {
  FakeSearchRepository({List<Product>? products, this.error})
    : products = products ?? [createTestProduct()];

  final List<Product> products;
  AppException? error;
  final searches = <({String? name, String? brand, String? barcode})>[];
  final barcodeLookups = <String>[];
  final pendingSearches = <String, Completer<List<Product>>>{};

  @override
  Future<Product> findByBarcode(String barcode) async {
    barcodeLookups.add(barcode);
    if (error != null) throw error!;
    return products.firstWhere(
      (product) => product.barcode == barcode,
      orElse: () => throw const NotFoundException('Продукт не найден.'),
    );
  }

  @override
  Future<TazaScorePreviewData> previewScore(String productId) {
    throw UnimplementedError('Product search tests do not use score preview.');
  }

  @override
  Future<List<Product>> search({
    String? name,
    String? brand,
    String? barcode,
    int pageSize = 20,
  }) async {
    searches.add((name: name, brand: brand, barcode: barcode));
    if (error != null) throw error!;

    final pending = pendingSearches[name];
    if (pending != null) {
      return pending.future;
    }

    return products.where((product) {
      if (name != null) {
        return product.name.toLowerCase().contains(name.toLowerCase());
      }
      if (brand != null) {
        return (product.brand ?? '').toLowerCase().contains(
          brand.toLowerCase(),
        );
      }
      if (barcode != null) {
        return product.barcode.contains(barcode);
      }
      return true;
    }).toList();
  }
}

void main() {
  testWidgets('shows clean initial search state before typing', (tester) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    expect(find.text('Найдите продукт'), findsOneWidget);
    expect(find.text('Введите название или бренд.'), findsOneWidget);
    expect(find.text('Ничего не найдено.'), findsNothing);
    expect(repository.searches, isEmpty);
  });

  testWidgets('debounces search while typing', (tester) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'Co');
    await tester.pump(const Duration(milliseconds: 349));

    expect(repository.searches, isEmpty);

    await tester.pump(const Duration(milliseconds: 1));
    await tester.pumpAndSettle();

    expect(repository.searches, hasLength(1));
    expect(repository.searches.single.name, 'Co');
  });

  testWidgets('cancels previous in-flight search result', (tester) async {
    final repository = FakeSearchRepository();
    final first = Completer<List<Product>>();
    final second = Completer<List<Product>>();
    repository.pendingSearches['Co'] = first;
    repository.pendingSearches['Coca'] = second;
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'Co');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();

    await tester.enterText(find.byType(TextField), 'Coca');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();

    second.complete([createTestProduct(name: 'Coca Fresh')]);
    await tester.pumpAndSettle();

    first.complete([createTestProduct(name: 'Old Cola')]);
    await tester.pumpAndSettle();

    expect(find.text('Coca Fresh'), findsOneWidget);
    expect(find.text('Old Cola'), findsNothing);
    expect(repository.searches.map((search) => search.name), ['Co', 'Coca']);
  });

  testWidgets('does not search empty query', (tester) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), '   ');
    await tester.pump(const Duration(milliseconds: 400));

    expect(repository.searches, isEmpty);
  });

  testWidgets('does not search query shorter than two characters', (
    tester,
  ) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'C');
    await tester.pump(const Duration(milliseconds: 400));

    expect(repository.searches, isEmpty);
  });

  testWidgets('successful search updates result list', (tester) async {
    final repository = FakeSearchRepository();
    final pending = Completer<List<Product>>();
    repository.pendingSearches['cola'] = pending;
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    pending.complete(repository.products);
    await tester.pumpAndSettle();

    expect(repository.searches, hasLength(1));
    expect(repository.searches.single.name, 'cola');
    expect(repository.searches.single.brand, isNull);
    expect(repository.searches.single.barcode, isNull);
    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
  });

  testWidgets('search result shows TazaScore and category instead of legacy score', (
    tester,
  ) async {
    final repository = FakeSearchRepository(
      products: [
        createTestProduct(
          tazaScore: const TazaScorePreviewData(
            status: TazaScorePreviewStatus.calculated,
            score: 27,
            confidence: TazaScoreConfidence.high,
            methodologyVersion: 'taza-score-v1',
            ingredientAnalysisLabel: 'Информационный анализ',
            processingLabel: 'Пока не учитывается в TazaScore',
          ),
        ),
      ],
    );
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('TazaScore 27/100 · Низкий'), findsOneWidget);
    expect(find.textContaining('65/100'), findsNothing);
  });

  testWidgets('search result shows unavailable TazaScore without fake zero', (
    tester,
  ) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('TazaScore · нет данных'), findsOneWidget);
    expect(find.text('TazaScore 0/100 · Очень низкий'), findsNothing);
  });

  testWidgets('low-confidence result shows a compact incomplete-data hint', (
    tester,
  ) async {
    final repository = FakeSearchRepository(
      products: [
        createTestProduct(
          tazaScore: const TazaScorePreviewData(
            status: TazaScorePreviewStatus.calculated,
            score: 74,
            confidence: TazaScoreConfidence.low,
            nutritionCoverage: 0.31,
            methodologyVersion: 'taza-score-v1.1',
            ingredientAnalysisLabel: 'Информационный анализ',
            processingLabel: 'Пока не учитывается в TazaScore',
          ),
        ),
      ],
    );
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('TazaScore 74/100 · Хороший'), findsOneWidget);
    expect(find.text('Неполные данные'), findsOneWidget);
  });

  testWidgets('missing brand does not render a blank secondary line', (
    tester,
  ) async {
    final repository = FakeSearchRepository(
      products: [
        createTestProduct(
          name: 'Plain Water',
          brand: null,
          category: null,
          tazaScore: const TazaScorePreviewData(
            status: TazaScorePreviewStatus.calculated,
            score: 100,
            confidence: TazaScoreConfidence.high,
            methodologyVersion: 'taza-score-v1.1',
            ingredientAnalysisLabel: 'Информационный анализ',
            processingLabel: 'Пока не учитывается в TazaScore',
          ),
        ),
      ],
    );
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'water');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('Plain Water'), findsOneWidget);
    expect(find.text('TazaScore 100/100 · Отличный'), findsOneWidget);
    expect(find.text('null'), findsNothing);
  });

  testWidgets('missing image uses product placeholder', (tester) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.inventory_2_outlined), findsOneWidget);
  });

  testWidgets('long product name does not overflow', (tester) async {
    tester.view.physicalSize = const Size(320, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repository = FakeSearchRepository(
      products: [
        createTestProduct(
          name:
              'Очень длинное название продукта с большим количеством слов и уточнений вкуса',
          brand: 'Очень длинный бренд производителя',
        ),
      ],
    );
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'длин');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.textContaining('Очень длинное название'), findsOneWidget);
  });

  testWidgets('shows no results state', (tester) async {
    final repository = FakeSearchRepository(products: const []);
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'unknown');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('Ничего не найдено.'), findsOneWidget);
    expect(
      find.text('Не нашли продукт? Помогите добавить его.'),
      findsOneWidget,
    );
  });

  testWidgets('opens submission flow from no results state', (tester) async {
    final repository = FakeSearchRepository(products: const []);
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'unknown');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Добавить продукт'));
    await tester.pumpAndSettle();

    expect(find.text('Добавить продукт'), findsWidgets);
  });

  testWidgets('shows network error and retries', (tester) async {
    final repository = FakeSearchRepository()
      ..error = const NetworkException('Нет подключения к интернету.');
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('Не удалось выполнить поиск'), findsOneWidget);
    expect(
      find.text('Проверьте подключение и попробуйте снова.'),
      findsOneWidget,
    );

    repository.error = null;
    await tester.tap(find.text('Повторить'));
    await tester.pumpAndSettle();

    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
  });

  testWidgets('shows timeout state separately', (tester) async {
    final repository = FakeSearchRepository()
      ..error = const RequestTimeoutException('timeout');
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('Сервер долго отвечает'), findsOneWidget);
    expect(find.text('Попробуйте снова.'), findsOneWidget);
  });

  testWidgets('clear search action resets results and query', (tester) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Coca-Cola Original Taste'), findsNothing);
    expect(find.text('Найдите продукт'), findsOneWidget);
  });

  testWidgets('canonical technical metadata is not displayed', (tester) async {
    final repository = FakeSearchRepository(
      products: [
        createTestProduct(
          scoreSource: 'canonical_recipe',
          tazaScore: const TazaScorePreviewData(
            status: TazaScorePreviewStatus.calculated,
            score: 27,
            confidence: TazaScoreConfidence.high,
            methodologyVersion: 'taza-score-v1.1',
            ingredientAnalysisLabel: 'Информационный анализ',
            processingLabel: 'Пока не учитывается в TazaScore',
          ),
        ),
      ],
    );
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.textContaining('canonical'), findsNothing);
    expect(find.textContaining('canonical_recipe'), findsNothing);
  });

  testWidgets('opens existing product details screen', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Coca-Cola Original Taste'));
    await tester.pumpAndSettle();

    expect(find.text('Детали продукта'), findsOneWidget);
  });
}

Future<void> _pumpSearch(
  WidgetTester tester,
  FakeSearchRepository repository,
) async {
  await tester.pumpWidget(
    MaterialApp(
      home: ProductSearchScreen(productService: ProductService(repository)),
      onGenerateRoute: AppRouter.onGenerateRoute,
    ),
  );
}
