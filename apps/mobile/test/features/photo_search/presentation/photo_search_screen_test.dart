import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/photo_search/presentation/screens/photo_search_screen.dart';

void main() {
  testWidgets('Windows photo search uses file picker entry point', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: PhotoSearchScreen()));

    if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
      expect(find.text('Выбрать файл'), findsOneWidget);
      expect(find.text('Сделать фото'), findsNothing);
    } else {
      expect(find.text('Выбрать из галереи'), findsOneWidget);
      expect(find.text('Сделать фото'), findsOneWidget);
    }
  });
}
