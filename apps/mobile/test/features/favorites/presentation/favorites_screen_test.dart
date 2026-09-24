import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/favorites/data/datasources/favorites_local_data_source.dart';
import 'package:project/src/features/favorites/data/repositories/local_favorites_repository.dart';
import 'package:project/src/features/favorites/presentation/screens/favorites_screen.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../test_product_factory.dart';

void main() {
  testWidgets('renders polished empty state with search action', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('В избранном пока ничего нет'), findsOneWidget);
    expect(
      find.text(
        'Добавляйте продукты в избранное, чтобы быстро возвращаться к ним.',
      ),
      findsOneWidget,
    );
    expect(find.text('Поиск продукта'), findsOneWidget);
  });

  testWidgets('favorite card renders product identity and TazaScore', (
    tester,
  ) async {
    await _seedFavorite(
      createTestProduct(
        tazaScore: const TazaScorePreviewData(
          status: TazaScorePreviewStatus.calculated,
          score: 27,
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
    expect(find.text('Coca-Cola · Газированные напитки'), findsOneWidget);
    expect(find.text('TazaScore 27/100 · Низкий'), findsOneWidget);
    expect(find.byIcon(Icons.inventory_2_outlined), findsOneWidget);
    expect(find.textContaining('canonical'), findsNothing);
    expect(find.textContaining('legacy'), findsNothing);
  });

  testWidgets('favorite card shows unavailable score without fake zero', (
    tester,
  ) async {
    await _seedFavorite(createTestProduct());

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('TazaScore · нет данных'), findsOneWidget);
    expect(find.text('TazaScore 0/100 · Очень низкий'), findsNothing);
  });

  testWidgets('favorite card opens product details', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final repository = LocalFavoritesRepository(
      FavoritesLocalDataSource(preferences),
    );
    await repository.add(createTestProduct());

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Coca-Cola Original Taste'));
    await tester.pumpAndSettle();

    expect(find.text('Детали продукта'), findsOneWidget);
  });
}

Widget _app() {
  return MaterialApp(
    home: const FavoritesScreen(),
    onGenerateRoute: AppRouter.onGenerateRoute,
  );
}

Future<void> _seedFavorite(Product product) async {
  SharedPreferences.setMockInitialValues({});
  final preferences = await SharedPreferences.getInstance();
  final repository = LocalFavoritesRepository(
    FavoritesLocalDataSource(preferences),
  );
  await repository.add(product);
}
