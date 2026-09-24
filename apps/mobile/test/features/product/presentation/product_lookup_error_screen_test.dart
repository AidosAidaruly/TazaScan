import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/product/presentation/screens/product_lookup_error_screen.dart';
import 'package:project/src/features/product_submission/presentation/screens/product_submission_screen.dart';

void main() {
  testWidgets('opens product submission with the unknown barcode', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        routes: {
          AppRoutes.productSubmission: (context) => ProductSubmissionScreen(
            initialBarcode: ModalRoute.of(context)!.settings.arguments! as String,
          ),
        },
        home: const ProductLookupErrorScreen(
          title: 'Товар не найден',
          message: 'Этого штрихкода пока нет в нашей базе.',
          barcode: '5449000000996',
        ),
      ),
    );

    await tester.tap(find.text('Добавить продукт'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextFormField, '5449000000996'), findsOneWidget);
  });
}
