import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('Russian is the default locale', () {
    final strings = TazaStrings.forLocale(TazaLocale.ru);

    expect(strings.productSearch, 'Поиск продукта');
    expect(strings.scoreCategory(27), 'Низкий');
  });

  test('Kazakh locale exposes consumer flow strings', () {
    final strings = TazaStrings.forLocale(TazaLocale.kk);

    expect(strings.productSearch, 'Өнімді табу');
    expect(strings.photoSearch, 'Фото бойынша іздеу');
    expect(strings.favorites, 'Таңдаулылар');
    expect(strings.scoreCategory(27), 'Төмен');
    expect(strings.confidenceLabel('high'), 'Жоғары');
  });

  test('unsupported stored locale falls back to Russian', () async {
    SharedPreferences.setMockInitialValues({'tazascan.locale': 'en'});

    final controller = await TazaLocaleController.load();

    expect(controller.locale, TazaLocale.ru);
  });

  test('selected language is persisted', () async {
    SharedPreferences.setMockInitialValues({});
    final controller = await TazaLocaleController.load();

    await controller.setLocale(TazaLocale.kk);
    final reloaded = await TazaLocaleController.load();

    expect(reloaded.locale, TazaLocale.kk);
  });
}
