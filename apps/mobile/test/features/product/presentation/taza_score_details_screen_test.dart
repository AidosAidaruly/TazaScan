import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/presentation/screens/taza_score_details_screen.dart';

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

void main() {
  testWidgets('renders the score summary, breakdown and reliability sections', (
    tester,
  ) async {
    await _pumpScreen(tester, data: cocaColaPreview);

    expect(find.text('Как рассчитан TazaScore'), findsOneWidget);

    // Summary card: score, max and status.
    expect(find.text('27'), findsOneWidget);
    expect(find.text('/ 100'), findsOneWidget);
    expect(find.text('Низкий'), findsOneWidget);

    // "Из чего складывается" breakdown reuses the exact same component
    // point values as before — nothing recalculated.
    expect(find.text('Из чего складывается'), findsOneWidget);
    // The nutrition-profile / composition labels appear twice: once in the
    // summary card's legend, once as each breakdown row's own label.
    expect(find.text('Питательный профиль'), findsNWidgets(2));
    expect(find.text('17 / 90'), findsOneWidget);
    expect(find.text('Состав и добавки'), findsNWidgets(2));
    expect(find.text('10 / 10'), findsOneWidget);
    expect(find.text('Степень обработки'), findsOneWidget);
    expect(find.text('Пока не учитывается'), findsOneWidget);

    // "Достоверность оценки": confidence + coverage shown once, plus the
    // structured rows.
    expect(find.text('Достоверность оценки'), findsOneWidget);
    expect(find.text('Высокая'), findsOneWidget);
    expect(find.text('100% ключевых данных'), findsOneWidget);
    expect(find.text('Добавки'), findsOneWidget);
    expect(find.text('Информационный анализ'), findsOneWidget);

    // The disclosure notice at the bottom reuses the existing disclaimer
    // copy verbatim.
    expect(
      find.textContaining('Не является медицинской рекомендацией'),
      findsOneWidget,
    );

    // Nutri-Score now lives only in its own side-card on the summary
    // screen — it should not be duplicated here.
    expect(find.text('Nutri-Score'), findsNothing);
  });

  testWidgets(
    'shows the missing critical fields and safeguard notice, without raw ids',
    (tester) async {
      await _pumpScreen(tester, data: cappedPreview);

      expect(find.text('28'), findsOneWidget);
      expect(find.text('Низкая'), findsOneWidget);
      expect(find.text('31% ключевых данных'), findsOneWidget);

      expect(find.text('Не хватает важных данных'), findsOneWidget);
      expect(find.text('Сахар'), findsOneWidget);
      expect(find.text('Соль'), findsOneWidget);
      expect(find.text('Насыщенные жиры'), findsOneWidget);
      expect(
        find.text('Для защиты от завышенной оценки применено ограничение.'),
        findsOneWidget,
      );

      // Raw internal identifiers must never leak into the UI.
      expect(find.text('coverage_cap'), findsNothing);
      expect(find.text('missing_critical_negative_cap'), findsNothing);
      expect(find.text('scoreBeforeSafeguard'), findsNothing);
      expect(find.text('scoreCap'), findsNothing);
    },
  );

  testWidgets('fits narrow mobile width without layout exceptions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _pumpScreen(tester, data: cappedPreview);

    expect(tester.takeException(), isNull);
    expect(find.text('Как рассчитан TazaScore'), findsOneWidget);
  });
}

Future<void> _pumpScreen(
  WidgetTester tester, {
  required TazaScorePreviewData data,
}) async {
  tester.view.physicalSize = const Size(390, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(home: TazaScoreDetailsScreen(data: data)),
  );
}
