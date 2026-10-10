import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/history/data/datasources/history_local_data_source.dart';
import 'package:project/src/features/history/data/models/history_entry_model.dart';
import 'package:project/src/features/history/data/repositories/local_history_repository.dart';
import 'package:project/src/features/history/domain/entities/history_entry.dart';
import 'package:project/src/features/history/domain/repositories/history_repository.dart';
import 'package:project/src/features/history/presentation/screens/history_screen.dart';
import 'package:project/src/features/product/data/models/cached_product_summary_model.dart';
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

  testWidgets('a corrupt stored entry is skipped and valid history still shows', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      HistoryLocalDataSource.storageKey: jsonEncode([
        'garbage',
        _entryJson(createTestProduct(id: 'valid', name: 'Valid product')),
        {'product': 12, 'viewedAt': 'nope'},
      ]),
    });

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Valid product'), findsOneWidget);
    expect(find.text('История пока пуста'), findsNothing);
  });

  testWidgets('an older load finishing last cannot overwrite newer history', (
    tester,
  ) async {
    final repository = _ControlledHistoryRepository();
    await tester.pumpWidget(_app(repository: repository));

    // Initial load: A and B.
    repository.completeLoad(0, [_entry('a', 'Product A'), _entry('b', 'Product B')]);
    await tester.pumpAndSettle();
    expect(find.text('Product A'), findsOneWidget);

    // Two deletes start two newer loads (1 and 2) while both are still pending.
    await tester.tap(find.byTooltip('Удалить').first);
    await tester.pump();
    await tester.tap(find.byTooltip('Удалить').last);
    await tester.pump();
    expect(repository.pendingLoads, 3);

    // The newest load finishes first (nothing left), then the older one with stale data.
    repository.completeLoad(2, const []);
    await tester.pumpAndSettle();
    repository.completeLoad(1, [_entry('b', 'Product B')]);
    await tester.pumpAndSettle();

    expect(find.text('Product B'), findsNothing);
    expect(find.text('История пока пуста'), findsOneWidget);
  });

  testWidgets('a failing history load stops loading without escaping', (tester) async {
    await tester.pumpWidget(_app(repository: _FailingHistoryRepository()));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('История пока пуста'), findsOneWidget);
    expect(find.textContaining('storage exploded'), findsNothing);
  });

  testWidgets('delete and clear still work from the screen', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final repository = LocalHistoryRepository(HistoryLocalDataSource(preferences));
    await repository.saveViewedProduct(createTestProduct(id: 'one', name: 'First product'));
    await repository.saveViewedProduct(createTestProduct(id: 'two', name: 'Second product'));

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Удалить').first);
    await tester.pumpAndSettle();

    expect(find.text('Second product'), findsNothing);
    expect(find.text('First product'), findsOneWidget);

    await tester.tap(find.byTooltip('Очистить историю'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Очистить'));
    await tester.pumpAndSettle();

    expect(find.text('История пока пуста'), findsOneWidget);
    expect(await repository.list(), isEmpty);
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

Widget _app({HistoryRepository? repository}) {
  return MaterialApp(
    home: HistoryScreen(repository: repository),
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

Map<String, dynamic> _entryJson(Product product) {
  return HistoryEntryModel(
    product: CachedProductSummaryModel.fromProduct(product),
    viewedAt: DateTime.now(),
  ).toJson();
}

HistoryEntry _entry(String id, String name) {
  return HistoryEntry(
    product: CachedProductSummaryModel.fromProduct(createTestProduct(id: id, name: name)),
    viewedAt: DateTime.now(),
  );
}

/// Each list() call waits until the test completes it, in any order.
class _ControlledHistoryRepository implements HistoryRepository {
  final _loads = <Completer<List<HistoryEntry>>>[];

  int get pendingLoads => _loads.length;

  void completeLoad(int index, List<HistoryEntry> entries) => _loads[index].complete(entries);

  @override
  Future<List<HistoryEntry>> list() {
    final completer = Completer<List<HistoryEntry>>();
    _loads.add(completer);
    return completer.future;
  }

  @override
  Future<void> delete(String productId, DateTime viewedAt) async {}

  @override
  Future<void> clear() async {}

  @override
  Future<void> saveViewedProduct(Product product) async {}
}

class _FailingHistoryRepository implements HistoryRepository {
  @override
  Future<List<HistoryEntry>> list() => Future.error(StateError('storage exploded'));

  @override
  Future<void> delete(String productId, DateTime viewedAt) async {}

  @override
  Future<void> clear() async {}

  @override
  Future<void> saveViewedProduct(Product product) async {}
}
