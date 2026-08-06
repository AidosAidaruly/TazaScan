import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
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
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(repository.searches, hasLength(1));
    expect(repository.searches.single.name, 'cola');
    expect(repository.searches.single.brand, isNull);
    expect(repository.searches.single.barcode, isNull);
    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
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

    expect(find.text('Поиск не удался'), findsOneWidget);
    expect(find.text('Нет подключения к интернету.'), findsOneWidget);

    repository.error = null;
    await tester.tap(find.text('Повторить'));
    await tester.pumpAndSettle();

    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
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
