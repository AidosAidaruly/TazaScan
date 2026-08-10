import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/presentation/widgets/taza_score_beta_card.dart';

const testTazaScorePreview = TazaScorePreviewData(
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
  methodologyVersion: 'taza-score-v1',
  ingredientAnalysisLabel: 'Информационный анализ',
  processingLabel: 'Пока не учитывается в TazaScore',
);

void main() {
  testWidgets('renders TazaScore value out of 100', (tester) async {
    await _pumpCard(tester, data: testTazaScorePreview);

    expect(find.text('TazaScore Beta'), findsOneWidget);
    expect(find.text('27'), findsOneWidget);
    expect(find.text('/ 100'), findsOneWidget);
    expect(find.text('Оценка пищевого профиля продукта'), findsOneWidget);
  });

  testWidgets('renders Nutri-Score grade separately', (tester) async {
    await _pumpCard(tester, data: testTazaScorePreview);

    expect(find.text('Nutri-Score'), findsOneWidget);
    expect(find.text('E'), findsOneWidget);
  });

  testWidgets('collapsed state hides technical details and disclosure', (
    tester,
  ) async {
    await _pumpCard(tester, data: testTazaScorePreview);

    expect(find.text('Подробнее об оценке'), findsOneWidget);
    expect(find.text('Достоверность данных'), findsNothing);
    expect(find.text('Nutrition'), findsNothing);
    expect(find.text('Ingredients'), findsNothing);
    expect(find.text('Оценка основана на методике Nutri-Score'), findsNothing);
    expect(find.text('Добавки учтены информационно'), findsNothing);
    expect(
      find.textContaining('Не является медицинской рекомендацией.'),
      findsNothing,
    );
    expect(find.text('Legacy'), findsNothing);
    expect(find.text('69/100 + C'), findsNothing);
  });

  testWidgets('expanded state shows secondary details and disclosure', (
    tester,
  ) async {
    await _pumpCard(tester, data: testTazaScorePreview);

    await tester.tap(find.text('Подробнее об оценке'));
    await tester.pumpAndSettle();

    expect(find.text('Достоверность данных'), findsOneWidget);
    expect(find.text('Высокая'), findsOneWidget);
    expect(find.text('Nutrition'), findsOneWidget);
    expect(find.text('17 / 90'), findsOneWidget);
    expect(find.text('Ingredients'), findsOneWidget);
    expect(find.text('10 / 10'), findsOneWidget);
    expect(
      find.text('Оценка основана на методике Nutri-Score'),
      findsOneWidget,
    );
    expect(find.text('Добавки учтены информационно'), findsOneWidget);
    expect(
      find.textContaining('Не является медицинской рекомендацией.'),
      findsOneWidget,
    );
  });

  testWidgets('expanded state renders secondary TazaScore metadata', (
    tester,
  ) async {
    await _pumpCard(tester, data: testTazaScorePreview);

    await tester.tap(find.text('Подробнее об оценке'));
    await tester.pumpAndSettle();

    expect(find.text('Добавки'), findsOneWidget);
    expect(find.text('Информационный анализ'), findsOneWidget);
    expect(find.text('Степень обработки'), findsOneWidget);
    expect(find.text('Пока не учитывается'), findsOneWidget);
  });

  testWidgets('renders warning in collapsed primary view', (tester) async {
    await _pumpCard(tester, data: testTazaScorePreview);

    expect(find.text('Высокое содержание сахара'), findsOneWidget);
  });

  testWidgets('renders maximum three collapsed reasons', (tester) async {
    await _pumpCard(
      tester,
      data: const TazaScorePreviewData(
        status: TazaScorePreviewStatus.calculated,
        score: 31,
        nutritionComponent: 21,
        ingredientComponent: 10,
        nutriScoreGrade: 'D',
        confidence: TazaScoreConfidence.medium,
        reasonLabels: [
          'Высокое содержание сахара',
          'Высокое содержание соли',
          'Высокое содержание насыщенных жиров',
          'Высокая энергетическая ценность',
        ],
        methodologyVersion: 'taza-score-v1',
        ingredientAnalysisLabel: 'Информационный анализ',
        processingLabel: 'Пока не учитывается в TazaScore',
      ),
    );

    expect(find.text('Высокое содержание сахара'), findsOneWidget);
    expect(find.text('Высокое содержание соли'), findsOneWidget);
    expect(find.text('Высокое содержание насыщенных жиров'), findsOneWidget);
    expect(find.text('Высокая энергетическая ценность'), findsNothing);
  });

  testWidgets('renders neutral fallback when no specific reasons exist', (
    tester,
  ) async {
    await _pumpCard(
      tester,
      data: const TazaScorePreviewData(
        status: TazaScorePreviewStatus.calculated,
        score: 80,
        nutritionComponent: 70,
        ingredientComponent: 10,
        nutriScoreGrade: 'A',
        confidence: TazaScoreConfidence.high,
        methodologyVersion: 'taza-score-v1',
        ingredientAnalysisLabel: 'Информационный анализ',
        processingLabel: 'Пока не учитывается в TazaScore',
      ),
    );

    expect(find.text('Дополнительных замечаний нет.'), findsOneWidget);
  });

  testWidgets('renders insufficient-data state', (tester) async {
    await _pumpCard(
      tester,
      data: const TazaScorePreviewData(
        status: TazaScorePreviewStatus.insufficientData,
        confidence: TazaScoreConfidence.low,
        methodologyVersion: 'TazaScore v1.0 Beta',
        ingredientAnalysisLabel: 'Информационный анализ',
        processingLabel: 'Пока не учитывается в TazaScore',
        missingFields: ['sugars', 'salt'],
      ),
    );

    expect(find.text('Недостаточно данных'), findsOneWidget);
    expect(find.textContaining('sugars, salt'), findsOneWidget);
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

    await _pumpCard(tester, data: testTazaScorePreview);

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
