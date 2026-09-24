import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/photo_search/domain/entities/photo_search_result.dart';
import 'package:project/src/features/photo_search/presentation/screens/photo_search_screen.dart';
import 'package:project/src/features/product_search/presentation/screens/product_search_screen.dart';

void main() {
  testWidgets('Windows photo search uses file picker entry point', (
    tester,
  ) async {
    await tester.pumpWidget(_app(const PhotoSearchScreen()));

    if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
      expect(find.text('Выбрать файл'), findsOneWidget);
      expect(find.text('Сделать фото'), findsNothing);
    } else {
      expect(find.text('Выбрать из галереи'), findsOneWidget);
      expect(find.text('Сделать фото'), findsOneWidget);
    }
  });

  testWidgets('renders guidance near photo selection', (tester) async {
    await tester.pumpWidget(_app(const PhotoSearchScreen()));

    expect(
      find.text(
        'Лучше всего работает, если название продукта хорошо видно на фото.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('no-match state shows fallback actions without network error', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        const PhotoSearchScreen(
          initialResult: PhotoSearchResult(matches: [], message: null),
        ),
      ),
    );

    expect(find.text('Продукт по фото не найден'), findsOneWidget);
    expect(
      find.text(
        'Попробуйте отсканировать штрихкод или найти продукт по названию.',
      ),
      findsOneWidget,
    );
    expect(find.text('Сканировать штрихкод'), findsOneWidget);
    expect(find.text('Найти по названию'), findsOneWidget);
    expect(find.text('Выбрать другое фото'), findsOneWidget);
    expect(find.text('Не удалось выполнить поиск'), findsNothing);
  });

  testWidgets('scanner fallback navigates to existing scanner route', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        const PhotoSearchScreen(
          initialResult: PhotoSearchResult(matches: [], message: null),
        ),
      ),
    );

    await tester.ensureVisible(find.text('Сканировать штрихкод'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Сканировать штрихкод'));
    await tester.pumpAndSettle();

    expect(find.text('Scanner route'), findsOneWidget);
  });

  testWidgets('text-search fallback navigates to product search route', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        const PhotoSearchScreen(
          initialResult: PhotoSearchResult(matches: [], message: null),
        ),
      ),
    );

    await tester.ensureVisible(find.text('Найти по названию'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Найти по названию'));
    await tester.pumpAndSettle();

    expect(find.byType(ProductSearchScreen), findsOneWidget);
    expect(find.text('Название, бренд или штрихкод'), findsOneWidget);
  });

  testWidgets('network and unreadable-image errors remain separate', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        const PhotoSearchScreen(
          initialErrorMessage:
              'Не удалось открыть изображение. Попробуйте выбрать другое фото.',
        ),
      ),
    );

    expect(
      find.text(
        'Не удалось открыть изображение. Попробуйте выбрать другое фото.',
      ),
      findsOneWidget,
    );
    expect(find.text('Товар по фото не найден'), findsNothing);
  });
}

Widget _app(Widget home) {
  return MaterialApp(
    home: home,
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
