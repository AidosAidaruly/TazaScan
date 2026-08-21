import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/app.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/home/presentation/screens/home_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('shows home screen actions', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await _pumpTazaScan(tester);

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('TazaScan', skipOffstage: false), findsWidgets);
    expect(find.text('Сканировать продукт', skipOffstage: false), findsWidgets);
    expect(find.text('Поиск по фото', skipOffstage: false), findsWidgets);
    expect(find.text('Поиск продукта', skipOffstage: false), findsWidgets);

    expect(find.text('Пока нет сканов', skipOffstage: false), findsWidgets);
  });

  testWidgets('tapping product search card opens search screen', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await _pumpTazaScan(tester);

    await tester.tap(find.text('Поиск продукта').first);
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsNothing);
    expect(find.text('Название, бренд или штрихкод'), findsOneWidget);
    expect(find.text('Найдите продукт'), findsOneWidget);
    expect(find.text('Введите название или бренд.'), findsOneWidget);
  });

  testWidgets('bottom navigation opens favorites', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await _pumpTazaScan(tester);

    await tester.tap(find.text('Избранное'));
    await tester.pumpAndSettle();

    expect(find.text('Избранное'), findsWidgets);
    expect(find.text('В избранном пока пусто.'), findsOneWidget);
  });

  testWidgets('product not found can open submission flow', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await _pumpTazaScan(tester);

    Navigator.of(tester.element(find.byType(HomeScreen))).pushNamed(
      AppRoutes.productLookupError,
      arguments: const ProductLookupErrorArguments(
        title: 'Продукт не найден',
        message: 'Этого штрихкода пока нет в нашей базе.',
        barcode: '5449000000996',
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Добавить продукт'));
    await tester.pumpAndSettle();

    expect(find.text('Добавить продукт'), findsWidgets);
    expect(find.widgetWithText(TextFormField, '5449000000996'), findsOneWidget);
  });
}

Future<void> _pumpTazaScan(WidgetTester tester) async {
  tester.view.physicalSize = const Size(430, 1100);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(const ProjectApp());
  await tester.pump(const Duration(milliseconds: 1200));
  await tester.pumpAndSettle();
}
