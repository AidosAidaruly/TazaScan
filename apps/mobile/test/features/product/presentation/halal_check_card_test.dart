import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/features/product/domain/entities/halal_check.dart';
import 'package:project/src/features/product/presentation/widgets/halal_check_card.dart';

void main() {
  testWidgets('screening clear does not look like confirmed halal', (tester) async {
    await _pumpCard(
      tester,
      const HalalCheck(
        status: HalalCheckStatus.screeningClear,
        ingredientScreeningStatus: HalalIngredientScreeningStatus.clear,
        reasons: ['NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED'],
        matchedSignals: [],
        certificationStatus: 'not_verified',
        methodology: 'halal-check-v1.2',
      ),
    );

    expect(find.byIcon(Icons.shield_outlined), findsOneWidget);
    expect(find.byIcon(Icons.verified_rounded), findsNothing);
    expect(find.text('По составу явных проблем не обнаружено'), findsOneWidget);
    expect(find.text('Не подтверждена'), findsOneWidget);
    expect(find.textContaining('не является подтверждением'), findsNothing);
    expect(find.textContaining('screening_clear'), findsNothing);
  });

  testWidgets('confirmed halal uses confirmed certification visual', (tester) async {
    await _pumpCard(
      tester,
      const HalalCheck(
        status: HalalCheckStatus.halalConfirmed,
        ingredientScreeningStatus: HalalIngredientScreeningStatus.clear,
        reasons: ['CERTIFICATION_VERIFIED'],
        matchedSignals: [],
        certificationStatus: 'verified',
        methodology: 'halal-check-v1.2',
      ),
    );

    expect(find.byIcon(Icons.verified_rounded), findsOneWidget);
    expect(find.text('Халяль подтверждён'), findsOneWidget);
    expect(find.text('Подтверждена'), findsOneWidget);
  });

  testWidgets('review required and non halal states keep reason text', (tester) async {
    await _pumpCard(
      tester,
      const HalalCheck(
        status: HalalCheckStatus.reviewRequired,
        ingredientScreeningStatus: HalalIngredientScreeningStatus.reviewRequired,
        reasons: ['GELATIN_SOURCE_UNKNOWN'],
        matchedSignals: [
          HalalMatchedSignal(
            reasonCode: 'GELATIN_SOURCE_UNKNOWN',
            severity: 'review_required',
            matchedText: 'gelatin',
          ),
        ],
        certificationStatus: 'not_verified',
        methodology: 'halal-check-v1.2',
      ),
    );

    expect(find.byIcon(Icons.warning_amber_rounded), findsWidgets);
    expect(find.text('Требует проверки'), findsOneWidget);
    expect(find.textContaining('Желатин'), findsOneWidget);

    await _pumpCard(
      tester,
      const HalalCheck(
        status: HalalCheckStatus.nonHalal,
        ingredientScreeningStatus: HalalIngredientScreeningStatus.nonHalalDetected,
        reasons: ['PORK_FAT_DETECTED'],
        matchedSignals: [
          HalalMatchedSignal(
            reasonCode: 'PORK_FAT_DETECTED',
            severity: 'non_halal',
            matchedText: 'pork fat',
          ),
        ],
        certificationStatus: 'not_verified',
        methodology: 'halal-check-v1.2',
      ),
    );

    expect(find.byIcon(Icons.block_rounded), findsWidgets);
    expect(find.text('Обнаружен нехаляльный ингредиент'), findsOneWidget);
    expect(find.textContaining('Обнаружен свиной жир'), findsOneWidget);
  });

  testWidgets('insufficient data uses neutral info visual', (tester) async {
    await _pumpCard(
      tester,
      const HalalCheck(
        status: HalalCheckStatus.insufficientData,
        ingredientScreeningStatus: HalalIngredientScreeningStatus.insufficientData,
        reasons: ['INGREDIENTS_MISSING'],
        matchedSignals: [],
        certificationStatus: 'not_verified',
        methodology: 'halal-check-v1.2',
      ),
    );

    expect(find.byIcon(Icons.help_outline_rounded), findsWidgets);
    expect(find.text('Недостаточно данных'), findsOneWidget);
  });

  test('RU and KK badge labels are localized without raw enums', () {
    expect(
      TazaStrings.forLocale(TazaLocale.ru).halalBadgeLabel(
        HalalCheckStatus.screeningClear,
      ),
      'Без явных проблем',
    );
    expect(
      TazaStrings.forLocale(TazaLocale.kk).halalBadgeLabel(
        HalalCheckStatus.screeningClear,
      ),
      'Айқын мәселе жоқ',
    );
  });
}

Future<void> _pumpCard(WidgetTester tester, HalalCheck check) async {
  final controller = TazaLocaleController(initialLocale: TazaLocale.ru);

  await tester.pumpWidget(
    TazaLocalizationScope(
      controller: controller,
      child: MaterialApp(
        locale: controller.flutterLocale,
        supportedLocales: const [Locale('ru'), Locale('kk')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Scaffold(
          body: HalalCheckCard(halalCheck: check),
        ),
      ),
    ),
  );
}
