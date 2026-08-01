import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/features/product_submission/domain/entities/product_submission_draft.dart';
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

    await tester.tap(find.widgetWithText(FilledButton, 'Review and submit'));
    await tester.pump();

    expect(find.text('Add barcode, product name, or front photo.'), findsOneWidget);
  });

  testWidgets('submits successfully after review confirmation', (tester) async {
    final repository = FakeSubmissionRepository();
    await tester.pumpWidget(
      MaterialApp(home: ProductSubmissionScreen(repository: repository)),
    );

    await tester.enterText(find.byType(TextFormField).at(1), 'Coca-Cola');
    await tester.tap(find.widgetWithText(FilledButton, 'Review and submit'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit'));
    await tester.pumpAndSettle();

    expect(repository.lastDraft?.name, 'Coca-Cola');
    expect(find.textContaining('sent for moderation'), findsOneWidget);
  });

  testWidgets('shows upload error and allows retry', (tester) async {
    final repository = FakeSubmissionRepository()
      ..error = const NetworkException('No internet connection.');
    await tester.pumpWidget(
      MaterialApp(home: ProductSubmissionScreen(repository: repository)),
    );

    await tester.enterText(find.byType(TextFormField).at(1), 'Coca-Cola');
    await tester.tap(find.widgetWithText(FilledButton, 'Review and submit'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit'));
    await tester.pumpAndSettle();

    expect(find.text('No internet connection.'), findsOneWidget);
    expect(find.text('Review and submit'), findsOneWidget);
  });
}
