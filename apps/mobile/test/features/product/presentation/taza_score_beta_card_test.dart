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
  reasonLabels: ['Много сахара'],
  nutritionCoverage: 1,
  methodologyVersion: 'taza-score-v1.1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

const completeGoodPreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 86,
  nutritionComponent: 76,
  ingredientComponent: 10,
  nutriScoreGrade: 'A',
  confidence: TazaScoreConfidence.high,
  reasonLabels: ['Есть пищевые волокна', 'Источник белка'],
  nutritionCoverage: 1,
  methodologyVersion: 'taza-score-v1.1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

const partialPreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 74,
  nutritionComponent: 64,
  ingredientComponent: 10,
  confidence: TazaScoreConfidence.medium,
  reasonLabels: ['Мало благоприятных пищевых компонентов'],
  missingFields: ['Клетчатка', 'Доля фруктов/овощей/бобовых'],
  nutritionCoverage: 0.7818,
  methodologyVersion: 'taza-score-v1.1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

const cappedPreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 28,
  nutritionComponent: 79,
  ingredientComponent: 10,
  confidence: TazaScoreConfidence.low,
  missingFields: ['Сахар', 'Соль', 'Насыщенные жиры', 'Клетчатка'],
  missingCriticalFields: ['Сахар', 'Соль', 'Насыщенные жиры'],
  nutritionCoverage: 0.309,
  scoreBeforeSafeguard: 89,
  scoreCap: 28,
  safeguardsApplied: ['coverage_cap', 'missing_critical_negative_cap'],
  methodologyVersion: 'taza-score-v1.1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

const beverageCappedPreview = TazaScorePreviewData(
  status: TazaScorePreviewStatus.calculated,
  score: 32,
  confidence: TazaScoreConfidence.low,
  nutritionCoverage: 0.4,
  safeguardsApplied: ['beverage_official_metadata_cap'],
  methodologyVersion: 'taza-score-v1.1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

void main() {
  testWidgets('renders TazaScore score and category label', (tester) async {
    await _pumpCard(tester, data: cocaColaPreview);

    expect(find.text('TazaScore'), findsOneWidget);
    expect(find.text('27'), findsOneWidget);
    expect(find.text('/ 100'), findsOneWidget);
    expect(find.text('Низкий'), findsOneWidget);
    expect(find.text('Оценка пищевого профиля продукта'), findsOneWidget);
  });

  testWidgets('renders negative reason and hides raw enums', (tester) async {
    await _pumpCard(tester, data: cocaColaPreview);

    expect(find.text('Почему такая оценка'), findsOneWidget);
    expect(find.text('Много сахара'), findsOneWidget);
    expect(find.text('HIGH_SUGAR'), findsNothing);
  });

  testWidgets('renders positive reasons when supported', (tester) async {
    await _pumpCard(tester, data: completeGoodPreview);

    expect(find.text('Отличный'), findsOneWidget);
    expect(find.text('Есть пищевые волокна'), findsOneWidget);
    expect(find.text('Источник белка'), findsOneWidget);
  });

  testWidgets('renders medium confidence, coverage and partial message', (
    tester,
  ) async {
    await _pumpCard(tester, data: partialPreview);

    expect(find.text('Хороший'), findsOneWidget);
    expect(find.text('Nutri-Score'), findsOneWidget);
    expect(find.text('Недоступен из-за неполных данных'), findsOneWidget);
    expect(
      find.text(
        'Некоторые данные о продукте отсутствуют. Оценка рассчитана по доступной информации.',
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('Подробнее об оценке'));
    await tester.pumpAndSettle();

    expect(find.text('Достоверность оценки'), findsOneWidget);
    expect(find.text('Средняя'), findsOneWidget);
    expect(find.text('Доступно ключевых данных'), findsOneWidget);
    expect(find.text('78%'), findsOneWidget);
  });

  testWidgets('renders low confidence and safeguard consumer message', (
    tester,
  ) async {
    await _pumpCard(tester, data: cappedPreview);

    expect(find.text('28'), findsOneWidget);
    expect(find.text('Низкий'), findsOneWidget);
    expect(find.text('Оценка ограничена из-за неполных данных.'), findsOneWidget);
    expect(find.text('Данных недостаточно для высокой точности оценки.'), findsOneWidget);
    expect(find.text('coverage_cap'), findsNothing);
    expect(find.text('missing_critical_negative_cap'), findsNothing);
    expect(find.text('scoreBeforeSafeguard'), findsNothing);
    expect(find.text('scoreCap'), findsNothing);

    await tester.tap(find.text('Подробнее об оценке'));
    await tester.pumpAndSettle();

    expect(find.text('Низкая'), findsOneWidget);
    expect(find.text('31%'), findsOneWidget);
    expect(find.text('Не хватает важных данных'), findsOneWidget);
    expect(find.text('Сахар'), findsOneWidget);
    expect(find.text('Соль'), findsOneWidget);
    expect(find.text('Насыщенные жиры'), findsOneWidget);
    expect(
      find.text('Для защиты от завышенной оценки применено ограничение.'),
      findsOneWidget,
    );
  });

  testWidgets('renders beverage safeguard without raw id', (tester) async {
    await _pumpCard(tester, data: beverageCappedPreview);

    expect(
      find.text(
        'Для напитка не хватает части данных, поэтому итоговая оценка ограничена.',
      ),
      findsOneWidget,
    );
    expect(find.text('beverage_official_metadata_cap'), findsNothing);
  });

  testWidgets('renders insufficient-data state without fake zero', (tester) async {
    await _pumpCard(
      tester,
      data: const TazaScorePreviewData(
        status: TazaScorePreviewStatus.insufficientData,
        confidence: TazaScoreConfidence.low,
        methodologyVersion: 'taza-score-v1.1',
        ingredientAnalysisLabel: 'Информационный анализ',
        processingLabel: 'Пока не учитывается в TazaScore',
        missingFields: ['Сахар', 'Соль'],
      ),
    );

    expect(find.text('TazaScore пока недоступен'), findsOneWidget);
    expect(find.textContaining('Не хватает: Сахар, Соль'), findsOneWidget);
    expect(find.text('0'), findsNothing);
  });

  testWidgets('keeps disclosure collapsed and hides legacy by default', (
    tester,
  ) async {
    await _pumpCard(tester, data: cocaColaPreview);

    expect(find.text('Подробнее об оценке'), findsOneWidget);
    expect(find.text('Достоверность оценки'), findsNothing);
    expect(find.textContaining('Не является медицинской рекомендацией'), findsNothing);
    expect(find.text('Legacy'), findsNothing);

    await tester.tap(find.text('Подробнее об оценке'));
    await tester.pumpAndSettle();

    expect(find.text('Достоверность оценки'), findsOneWidget);
    expect(find.text('Высокая'), findsOneWidget);
    expect(find.text('Питательный профиль'), findsOneWidget);
    expect(find.text('17 / 90'), findsOneWidget);
    expect(find.text('Состав и добавки'), findsOneWidget);
    expect(find.text('10 / 10'), findsOneWidget);
    expect(find.textContaining('Не является медицинской рекомендацией'), findsOneWidget);
  });

  testWidgets('renders loading and error states', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: TazaScoreBetaCard(isLoading: true)),
      ),
    );

    expect(find.text('Загрузка оценки продукта...'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

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

    expect(find.text('Не удалось загрузить данные продукта.'), findsOneWidget);
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

    await _pumpCard(tester, data: cappedPreview);

    expect(tester.takeException(), isNull);
    expect(find.text('TazaScore'), findsOneWidget);
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
