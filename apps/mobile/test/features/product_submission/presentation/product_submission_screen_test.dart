import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/features/product_submission/domain/entities/product_submission_draft.dart';
import 'package:project/src/features/product_submission/domain/entities/submission_ocr_candidate.dart';
import 'package:project/src/features/product_submission/domain/repositories/product_submission_repository.dart';
import 'package:project/src/features/product_submission/presentation/screens/product_submission_screen.dart';

class FakeSubmissionRepository implements ProductSubmissionRepository {
  ProductSubmissionDraft? lastDraft;
  AppException? error;

  @override
  Future<void> submit(ProductSubmissionDraft draft) async {
    lastDraft = draft;
    final error = this.error;
    if (error != null) {
      throw error;
    }
  }

  @override
  Future<NutritionOcrCandidate> recognizeNutrition(XFile image) async {
    return const NutritionOcrCandidate(
      nutrition: {},
      detectedBasis: 'unknown',
      warnings: [],
    );
  }

  @override
  Future<IngredientsOcrCandidate> recognizeIngredients(XFile image) async {
    return const IngredientsOcrCandidate(
      value: null,
      confidence: 'not_detected',
      detectedLanguage: 'unknown',
      warnings: [],
    );
  }
}

void main() {
  testWidgets('prefills barcode', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ProductSubmissionScreen(initialBarcode: '5449000000996'),
      ),
    );

    expect(find.widgetWithText(TextFormField, '5449000000996'), findsOneWidget);
  });

  testWidgets('validates identifying data', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: ProductSubmissionScreen()));

    await tester.tap(
      find.widgetWithText(FilledButton, 'Проверить и отправить'),
    );
    await tester.pump();

    expect(
      find.text('Добавь штрихкод, название продукта или фото упаковки.'),
      findsOneWidget,
    );
  });

  testWidgets('requires front photo for unknown barcode flow', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ProductSubmissionScreen(initialBarcode: '5449000000996'),
      ),
    );

    await tester.enterText(find.byType(TextFormField).at(1), 'Coca-Cola');
    await tester.tap(
      find.widgetWithText(FilledButton, 'Проверить и отправить'),
    );
    await tester.pump();

    expect(
      find.text(
        'Добавь фото лицевой стороны упаковки, чтобы модератор проверил продукт.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('submits successfully after review confirmation', (tester) async {
    final repository = FakeSubmissionRepository();
    await tester.pumpWidget(
      MaterialApp(home: ProductSubmissionScreen(repository: repository)),
    );

    await tester.enterText(find.byType(TextFormField).at(1), 'Coca-Cola');
    await tester.tap(
      find.widgetWithText(FilledButton, 'Проверить и отправить'),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Отправить'));
    await tester.pumpAndSettle();

    expect(repository.lastDraft?.name, 'Coca-Cola');
    expect(find.textContaining('отправлен на модерацию'), findsOneWidget);
  });

  testWidgets('shows upload error and allows retry', (tester) async {
    final repository = FakeSubmissionRepository()
      ..error = const NetworkException('Нет подключения к интернету.');
    await tester.pumpWidget(
      MaterialApp(home: ProductSubmissionScreen(repository: repository)),
    );

    await tester.enterText(find.byType(TextFormField).at(1), 'Coca-Cola');
    await tester.tap(
      find.widgetWithText(FilledButton, 'Проверить и отправить'),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Отправить'));
    await tester.pumpAndSettle();

    expect(find.text('Проверьте подключение и попробуйте снова.'), findsOneWidget);
    expect(find.text('Проверить и отправить'), findsOneWidget);
  });
}
