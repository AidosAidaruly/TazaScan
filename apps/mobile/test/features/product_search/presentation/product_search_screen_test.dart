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
  FakeSearchRepository({List<Product>? products, this.delay, this.error})
    : products = products ?? [createTestProduct()];

  final List<Product> products;
  final Completer<void>? delay;
  AppException? error;
  final searches = <({String? name, String? brand, String? barcode})>[];
  final barcodeLookups = <String>[];

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
    if (delay != null) await delay!.future;
    if (error != null) throw error!;

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
  testWidgets('typing text triggers search by name and brand', (tester) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pumpAndSettle();

    expect(repository.searches.any((search) => search.name == 'cola'), isTrue);
    expect(repository.searches.any((search) => search.brand == 'cola'), isTrue);
    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
  });

  testWidgets('searching by name returns matching product', (tester) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'Original');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();

    expect(
      repository.searches.any((search) => search.name == 'Original'),
      isTrue,
    );
    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
  });

  testWidgets('searching by brand returns matching product', (tester) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'Coca-Cola');
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pumpAndSettle();

    expect(
      repository.searches.any((search) => search.brand == 'Coca-Cola'),
      isTrue,
    );
    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
  });

  testWidgets('searching by barcode prioritizes exact barcode lookup', (
    tester,
  ) async {
    final repository = FakeSearchRepository();
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), '5449000000996');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();

    expect(repository.barcodeLookups, ['5449000000996']);
    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
  });

  testWidgets('shows loading state', (tester) async {
    final delay = Completer<void>();
    final repository = FakeSearchRepository(delay: delay);
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pump();

    expect(find.text('Ищем продукт...'), findsOneWidget);

    delay.complete();
    await tester.pumpAndSettle();
  });

  testWidgets('shows empty result and opens submission flow', (tester) async {
    final repository = FakeSearchRepository(products: const []);
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'unknown');
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pumpAndSettle();

    expect(find.text('Ничего не найдено.'), findsOneWidget);
    expect(
      find.text('Не нашли продукт? Помогите добавить его.'),
      findsOneWidget,
    );

    await tester.tap(find.text('Добавить продукт'));
    await tester.pumpAndSettle();

    expect(find.text('Добавить продукт'), findsWidgets);
  });

  testWidgets('shows network error and retries', (tester) async {
    final repository = FakeSearchRepository()
      ..error = const NetworkException('Нет подключения к интернету.');
    await _pumpSearch(tester, repository);

    await tester.enterText(find.byType(TextField), 'cola');
    await tester.pump(const Duration(milliseconds: 450));
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
    await tester.pump(const Duration(milliseconds: 450));
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
