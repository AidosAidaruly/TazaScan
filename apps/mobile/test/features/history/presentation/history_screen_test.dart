import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/history/data/datasources/history_local_data_source.dart';
import 'package:project/src/features/history/data/repositories/local_history_repository.dart';
import 'package:project/src/features/history/presentation/screens/history_screen.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../test_product_factory.dart';

void main() {
  testWidgets('renders polished empty state with scanner action', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('История пока пуста'), findsOneWidget);
    expect(
      find.text(
        'Здесь появятся продукты, которые вы открывали или сканировали.',
      ),
      findsOneWidget,
    );
    expect(find.text('Сканировать продукт'), findsOneWidget);
  });

  testWidgets('history card renders product with TazaScore presentation', (
    tester,
  ) async {
    await _seedHistory(
      createTestProduct(
        tazaScore: const TazaScorePreviewData(
          status: TazaScorePreviewStatus.calculated,
          score: 86,
          confidence: TazaScoreConfidence.high,
          methodologyVersion: 'taza-score-v1.1',
          ingredientAnalysisLabel: 'Информационный анализ',
          processingLabel: 'Пока не учитывается в TazaScore',
        ),
      ),
    );

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('Coca-Cola Original Taste'), findsOneWidget);
    expect(find.text('TazaScore 86/100 · Отличный'), findsOneWidget);
    expect(find.textContaining('legacy'), findsNothing);
    expect(find.textContaining('canonical'), findsNothing);
  });

  testWidgets('history card shows unavailable score without fake zero', (
    tester,
  ) async {
    await _seedHistory(createTestProduct());

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('TazaScore · нет данных'), findsOneWidget);
    expect(find.text('TazaScore 0/100 · Очень низкий'), findsNothing);
  });

  testWidgets('long history product name does not overflow', (tester) async {
    tester.view.physicalSize = const Size(320, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await _seedHistory(
      createTestProduct(
        name:
            'Очень длинное название продукта с большим количеством слов и уточнений вкуса',
        brand: 'Очень длинный бренд производителя',
      ),
    );

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.textContaining('Очень длинное название'), findsOneWidget);
  });

  testWidgets('history card opens product details', (tester) async {
    await _seedHistory(createTestProduct());

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Coca-Cola Original Taste'));
    await tester.pumpAndSettle();

    expect(find.text('Детали продукта'), findsOneWidget);
  });
}

Widget _app() {
  return MaterialApp(
    home: const HistoryScreen(),
    onGenerateRoute: (settings) {
      if (settings.name == AppRoutes.scanner) {
        return MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('Scanner route')),
          settings: settings,
        );
      }

      return AppRouter.onGenerateRoute(settings);
    },
  );
}

Future<void> _seedHistory(Product product) async {
  SharedPreferences.setMockInitialValues({});
  final preferences = await SharedPreferences.getInstance();
  final repository = LocalHistoryRepository(
    HistoryLocalDataSource(preferences),
  );
  await repository.saveViewedProduct(product);
}
