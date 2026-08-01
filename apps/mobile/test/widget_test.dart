import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/app.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/home/presentation/screens/home_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('shows home screen actions', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const ProjectApp());

    expect(find.text('Project'), findsOneWidget);
    expect(find.text('Scan Product'), findsOneWidget);
    expect(find.text('Photo Search'), findsOneWidget);
    expect(find.text('Search Product'), findsOneWidget);

    await tester.scrollUntilVisible(find.text('No recent scans yet'), 200);

    expect(find.text('No recent scans yet'), findsOneWidget);
  });

  testWidgets('bottom navigation opens Favorites', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const ProjectApp());

    await tester.tap(find.text('Favorites'));
    await tester.pumpAndSettle();

    expect(find.text('Favorites'), findsWidgets);
    expect(find.text('No favorites yet.'), findsOneWidget);
  });

  testWidgets('product not found can open submission flow', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const ProjectApp());

    Navigator.of(tester.element(find.byType(HomeScreen))).pushNamed(
      AppRoutes.productLookupError,
      arguments: const ProductLookupErrorArguments(
        title: 'Product not found',
        message: 'This barcode is not in our database yet.',
        barcode: '5449000000996',
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Help add this product'));
    await tester.pumpAndSettle();

    expect(find.text('Help add this product'), findsWidgets);
    expect(find.widgetWithText(TextFormField, '5449000000996'), findsOneWidget);
  });
}
