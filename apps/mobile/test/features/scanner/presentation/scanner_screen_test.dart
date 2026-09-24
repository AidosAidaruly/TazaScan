import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/domain/repositories/product_repository.dart';
import 'package:project/src/features/product/domain/services/product_service.dart';
import 'package:project/src/features/product/presentation/screens/product_details_screen.dart';
import 'package:project/src/features/product/presentation/screens/product_lookup_error_screen.dart';
import 'package:project/src/features/scanner/presentation/screens/scanner_screen.dart';

import '../../test_product_factory.dart';

class _FakeProductRepository implements ProductRepository {
  _FakeProductRepository({this.product, this.error});

  final Product? product;
  final Object? error;
  final List<String> requestedBarcodes = [];

  @override
  Future<Product> findByBarcode(String barcode) async {
    requestedBarcodes.add(barcode);
    final thrown = error;
    if (thrown != null) {
      throw thrown;
    }
    return product!;
  }

  @override
  Future<TazaScorePreviewData> previewScore(String productId) async {
    throw UnimplementedError();
  }

  @override
  Future<List<Product>> search({
    String? name,
    String? brand,
    String? barcode,
    int pageSize = 20,
  }) async {
    return product == null ? [] : [product!];
  }
}

void main() {
  testWidgets('manual entry button opens the barcode input sheet', (
    tester,
  ) async {
    await tester.pumpWidget(_app(ProductService(_FakeProductRepository())));
    await tester.pumpAndSettle();

    expect(find.text('Ввести штрихкод вручную'), findsOneWidget);

    await tester.tap(find.text('Ввести штрихкод вручную'));
    await tester.pumpAndSettle();

    expect(find.text('Введите штрихкод'), findsOneWidget);
    expect(
      find.text('Введите EAN или UPC с упаковки продукта'),
      findsOneWidget,
    );
    expect(find.text('Найти продукт'), findsOneWidget);
  });

  testWidgets(
    'invalid barcode shows a validation message and does not submit',
    (tester) async {
      final repository = _FakeProductRepository();
      await tester.pumpWidget(_app(ProductService(repository)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Ввести штрихкод вручную'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), '123');
      await tester.tap(find.text('Найти продукт'));
      await tester.pumpAndSettle();

      expect(
        find.text('Проверьте штрихкод: допустимая длина — 8, 12 или 13 цифр.'),
        findsOneWidget,
      );
      // The sheet stays open on invalid submit.
      expect(find.text('Введите штрихкод'), findsOneWidget);
      expect(repository.requestedBarcodes, isEmpty);
    },
  );

  testWidgets(
    'letters cannot be entered into the manual barcode field',
    (tester) async {
      await tester.pumpWidget(_app(ProductService(_FakeProductRepository())));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Ввести штрихкод вручную'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'abc123');

      expect(find.text('123'), findsOneWidget);
      expect(find.text('abc123'), findsNothing);
    },
  );

  testWidgets(
    'valid manual barcode reuses the existing lookup flow and opens product details',
    (tester) async {
      final product = createTestProduct();
      final repository = _FakeProductRepository(product: product);
      await tester.pumpWidget(_app(ProductService(repository)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Ввести штрихкод вручную'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), product.barcode);
      await tester.tap(find.text('Найти продукт'));
      await tester.pumpAndSettle();

      // Same repository call the camera path uses, with the manually typed
      // barcode.
      expect(repository.requestedBarcodes, [product.barcode]);
      expect(find.byType(ScannerScreen), findsNothing);
      expect(find.byType(ProductDetailsScreen), findsOneWidget);
      expect(find.text(product.name), findsOneWidget);
    },
  );

  testWidgets(
    'manual barcode not found opens the existing Product Not Found screen',
    (tester) async {
      const barcode = '5449000000996';
      final repository = _FakeProductRepository(
        error: const NotFoundException('Продукт не найден.'),
      );
      await tester.pumpWidget(_app(ProductService(repository)));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Ввести штрихкод вручную'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), barcode);
      await tester.tap(find.text('Найти продукт'));
      await tester.pumpAndSettle();

      expect(repository.requestedBarcodes, [barcode]);
      expect(find.byType(ProductLookupErrorScreen), findsOneWidget);
    },
  );
}

Widget _app(ProductService productService) {
  return MaterialApp(
    onGenerateRoute: AppRouter.onGenerateRoute,
    home: ScannerScreen(productService: productService),
  );
}
