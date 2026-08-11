import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/presentation/widgets/taza_score_beta_card.dart';

const cocaColaPreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 27,
  nutritionComponent: 17,
  ingredientComponent: 10,
  nutriScoreGrade: 'E',
  confidence: TazaScoreConfidence.high,
  reasonLabels: ['Высокое содержание сахара'],
  technicalReasonLabels: [
    'Оценка основана на методике Nutri-Score',
    'Добавки учтены информационно',
  ],
  nutritionCoverage: 1,
  methodologyVersion: 'taza-score-v1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

const wotoPreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 100,
  nutritionComponent: 90,
  ingredientComponent: 10,
  nutriScoreGrade: 'A',
  confidence: TazaScoreConfidence.high,
  nutritionCoverage: 1,
  methodologyVersion: 'taza-score-v1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

const ketchupPreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 74,
  nutritionComponent: 64,
  ingredientComponent: 10,
  confidence: TazaScoreConfidence.medium,
  reasonLabels: ['Мало благоприятных пищевых компонентов'],
  missingFields: ['Клетчатка', 'Доля фруктов/овощей/бобовых'],
  nutritionCoverage: 0.7818,
  methodologyVersion: 'taza-score-v1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

const mayoPreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 24,
  nutritionComponent: 14,
  ingredientComponent: 10,
  confidence: TazaScoreConfidence.low,
  reasonLabels: ['Высокая энергетическая ценность'],
  missingFields: [
    'Сахар',
    'Насыщенные жиры',
    'Соль',
    'Клетчатка',
    'Доля фруктов/овощей/бобовых',
  ],
  missingCriticalFields: ['Сахар', 'Соль', 'Насыщенные жиры'],
  nutritionCoverage: 0.309,
  methodologyVersion: 'taza-score-v1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

const tomatoPastePreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 28,
  nutritionComponent: 79,
  ingredientComponent: 10,
  confidence: TazaScoreConfidence.low,
  missingFields: [
    'Сахар',
    'Насыщенные жиры',
    'Соль',
    'Клетчатка',
    'Доля фруктов/овощей/бобовых',
  ],
  missingCriticalFields: ['Сахар', 'Соль', 'Насыщенные жиры'],
  nutritionCoverage: 0.309,
  scoreBeforeSafeguard: 89,
  scoreCap: 28,
  safeguardsApplied: ['coverage_cap', 'missing_critical_negative_cap'],
  methodologyVersion: 'taza-score-v1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

void main() {
  testWidgets('renders complete high-confidence WOTO without partial warning', (
    tester,
  ) async {
    await _pumpCard(tester, data: wotoPreview);

    expect(find.text('TazaScore Beta'), findsOneWidget);
    expect(find.text('100'), findsOneWidget);
    expect(find.text('/ 100'), findsOneWidget);
    expect(find.text('Nutri-Score'), findsOneWidget);
    expect(find.text('A'), findsOneWidget);
    expect(find.text('Оценка рассчитана по неполным данным продукта.'), findsNothing);
    expect(find.text('Данных недостаточно для высокой точности оценки.'), findsNothing);
  });

  testWidgets('renders complete Coca-Cola score and Nutri-Score E', (
    tester,
  ) async {
    await _pumpCard(tester, data: cocaColaPreview);

    expect(find.text('27'), findsOneWidget);
    expect(find.text('E'), findsOneWidget);
    expect(find.text('Высокое содержание сахара'), findsOneWidget);
    expect(find.text('Оценка рассчитана по неполным данным продукта.'), findsNothing);
  });

  testWidgets('shows partial-data score, medium confidence and unavailable Nutri-Score', (
    tester,
  ) async {
    await _pumpCard(tester, data: ketchupPreview);

    expect(find.text('74'), findsOneWidget);
    expect(find.text('Достоверность'), findsOneWidget);
    expect(find.text('Средняя'), findsOneWidget);
    expect(find.text('Недоступен из-за неполных данных'), findsOneWidget);
    expect(find.text('Оценка рассчитана по неполным данным продукта.'), findsOneWidget);
  });

  testWidgets('shows low-confidence notice while keeping mayonnaise score visible', (
    tester,
  ) async {
    await _pumpCard(tester, data: mayoPreview);

    expect(find.text('24'), findsOneWidget);
    expect(find.text('Низкая'), findsOneWidget);
    expect(find.text('Оценка рассчитана по неполным данным продукта.'), findsOneWidget);
    expect(find.text('Данных недостаточно для высокой точности оценки.'), findsOneWidget);
  });

  testWidgets('shows safeguard notice for capped tomato paste score', (
    tester,
  ) async {
    await _pumpCard(tester, data: tomatoPastePreview);

    expect(find.text('28'), findsOneWidget);
    expect(
      find.text('Итоговая оценка ограничена из-за отсутствующих важных данных.'),
      findsOneWidget,
    );
    expect(find.text('scoreCap'), findsNothing);
    expect(find.text('scoreBeforeSafeguard'), findsNothing);
    expect(find.text('missingCriticalFields'), findsNothing);
  });

  testWidgets('expanded details show coverage, localized missing fields and cap details', (
    tester,
  ) async {
    await _pumpCard(tester, data: tomatoPastePreview);

    await tester.tap(find.text('Подробнее об оценке'));
    await tester.pumpAndSettle();

    expect(find.text('Достоверность данных'), findsOneWidget);
    expect(find.text('Низкая'), findsWidgets);
    expect(find.text('Покрытие данных'), findsOneWidget);
    expect(find.text('31%'), findsOneWidget);
    expect(find.text('Не хватает данных'), findsOneWidget);
    expect(find.text('Сахар'), findsOneWidget);
    expect(find.text('Соль'), findsOneWidget);
    expect(find.text('Насыщенные жиры'), findsOneWidget);
    expect(
      find.text('Для защиты от завышенной оценки применено ограничение.'),
      findsOneWidget,
    );
    expect(find.text('До ограничения'), findsOneWidget);
    expect(find.text('89'), findsOneWidget);
    expect(find.text('После ограничения'), findsOneWidget);
  });

  testWidgets('expanded details hide disclosure while collapsed', (tester) async {
    await _pumpCard(tester, data: cocaColaPreview);

    expect(find.text('Подробнее об оценке'), findsOneWidget);
    expect(find.text('Достоверность данных'), findsNothing);
    expect(find.text('Nutrition'), findsNothing);
    expect(find.text('Ingredients'), findsNothing);
    expect(find.textContaining('Не является медицинской рекомендацией.'), findsNothing);
    expect(find.text('Legacy'), findsNothing);

    await tester.tap(find.text('Подробнее об оценке'));
    await tester.pumpAndSettle();

    expect(find.text('Достоверность данных'), findsOneWidget);
    expect(find.text('Высокая'), findsOneWidget);
    expect(find.text('Nutrition'), findsOneWidget);
    expect(find.text('17 / 90'), findsOneWidget);
    expect(find.text('Ingredients'), findsOneWidget);
    expect(find.text('10 / 10'), findsOneWidget);
    expect(find.textContaining('Не является медицинской рекомендацией.'), findsOneWidget);
  });

  testWidgets('renders neutral fallback when no specific reasons exist', (
    tester,
  ) async {
    await _pumpCard(tester, data: wotoPreview);

    expect(find.text('Дополнительных замечаний нет.'), findsOneWidget);
  });

  testWidgets('renders insufficient-data state with localized fields', (
    tester,
  ) async {
    await _pumpCard(
      tester,
      data: const TazaScorePreviewData(
        status: TazaScorePreviewStatus.insufficientData,
        confidence: TazaScoreConfidence.low,
        methodologyVersion: 'taza-score-v1',
        ingredientAnalysisLabel: 'Информационный анализ',
        processingLabel: 'Пока не учитывается в TazaScore',
        missingFields: ['Сахар', 'Соль'],
      ),
    );

    expect(find.text('Недостаточно данных'), findsOneWidget);
    expect(find.textContaining('Сахар, Соль'), findsOneWidget);
    expect(find.text('Низкая'), findsOneWidget);
  });

  testWidgets('renders loading state inside beta card', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: TazaScoreBetaCard(isLoading: true)),
      ),
    );

    expect(find.text('Загружаем новую оценку'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('27'), findsNothing);
  });

  testWidgets('renders network error and retry action', (tester) async {
    var retryCount = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TazaScoreBetaCard(
            errorMessage: 'network',
            onRetry: () => retryCount += 1,
          ),
        ),
      ),
    );

    expect(find.text('Не удалось загрузить новую оценку'), findsOneWidget);
    await tester.tap(find.text('Повторить'));
    expect(retryCount, 1);
  });

  testWidgets('fits narrow mobile width without layout exceptions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _pumpCard(tester, data: tomatoPastePreview);

    expect(tester.takeException(), isNull);
    expect(find.text('TazaScore Beta'), findsOneWidget);
  });
}

Future<void> _pumpCard(
  WidgetTester tester, {
  required TazaScorePreviewData data,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: TazaScoreBetaCard(data: data, legacyScore: _legacyScore()),
          ),
        ),
      ),
    ),
  );
}

NutritionScore _legacyScore() {
  return NutritionScore(
    score: 69,
    grade: 'C',
    status: 'calculated',
    positiveReasons: const [],
    negativeReasons: const ['High sugar content.'],
    warnings: const [],
    missingFields: const [],
    algorithm: 'legacy',
    algorithmVersion: '1',
    calculatedAt: DateTime.parse('2026-08-01T00:00:00.000Z'),
  );
}
