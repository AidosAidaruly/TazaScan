import 'package:project/src/core/localization/taza_localizations.dart';

class ProductPresentationLocalization {
  const ProductPresentationLocalization._();

  static String category(String? value, {TazaLocale locale = TazaLocale.ru}) {
    return _mapKnown(value, _labels(_categoryLabels, locale)) ??
        value?.trim() ??
        '';
  }

  static String ingredient(String value, {TazaLocale locale = TazaLocale.ru}) {
    return _mapKnown(value, _labels(_ingredientLabels, locale)) ?? value;
  }

  static String insight(String value, {TazaLocale locale = TazaLocale.ru}) {
    final mapped = _mapKnown(value, _labels(_insightLabels, locale));
    if (mapped != null) {
      return mapped;
    }

    final normalized = _normalize(value);
    if (normalized.isEmpty || _looksTechnical(normalized)) {
      return locale == TazaLocale.kk
          ? 'Баға өнімнің қолжетімді деректері бойынша есептелді.'
          : 'Оценка рассчитана по доступным данным продукта.';
    }

    return value;
  }

  static String dataStatus(String status, {TazaLocale locale = TazaLocale.ru}) {
    return switch (_normalize(status)) {
      'verified' => locale == TazaLocale.kk ? 'Тексерілген' : 'Проверено',
      'unverified' => locale == TazaLocale.kk
          ? 'Тексеру қажет'
          : 'Требуется проверка',
      'community' => locale == TazaLocale.kk
          ? 'Қауымдастық деректері'
          : 'Данные сообщества',
      'calculated' => locale == TazaLocale.kk ? 'Есептелді' : 'Рассчитано',
      'insufficient data' || 'insufficient_data' => locale == TazaLocale.kk
          ? 'Деректер жеткіліксіз'
          : 'Недостаточно данных',
      'requires review' || 'requires_review' => locale == TazaLocale.kk
          ? 'Тексеру қажет'
          : 'Требуется проверка',
      _ => locale == TazaLocale.kk ? 'Белгісіз' : 'Неизвестно',
    };
  }

  static String missingField(String value, {TazaLocale locale = TazaLocale.ru}) {
    final kk = locale == TazaLocale.kk;
    return switch (_normalizeField(value)) {
      'energykcal' ||
      'energykcalorenergykj' ||
      'energykj' => kk ? 'Энергия' : 'Энергия',
      'protein' => kk ? 'Ақуыз' : 'Белки',
      'carbohydrates' => kk ? 'Көмірсулар' : 'Углеводы',
      'sugars' => kk ? 'Қант' : 'Сахар',
      'fat' => kk ? 'Май' : 'Жиры',
      'saturatedfat' ||
      'saturatedfatapproximation' => kk ? 'Қаныққан майлар' : 'Насыщенные жиры',
      'fiber' => kk ? 'Тағамдық талшықтар' : 'Клетчатка',
      'salt' => kk ? 'Тұз' : 'Соль',
      'fruitvegetablelegumepercent' => kk
          ? 'Жеміс/көкөніс/бұршақ үлесі'
          : 'Доля фруктов/овощей/бобовых',
      'containsnonsugarsweeteners' => kk
          ? 'Некалориялық тәттілендіргіштер'
          : 'Некалорийные подсластители',
      _ => _mapKnown(value, _labels(_missingFieldLabels, locale)) ??
          insight(value, locale: locale),
    };
  }

  static Map<String, String> _labels(
    Map<String, ({String ru, String kk})> source,
    TazaLocale locale,
  ) {
    return source.map(
      (key, value) => MapEntry(key, locale == TazaLocale.kk ? value.kk : value.ru),
    );
  }

  static String? _mapKnown(String? value, Map<String, String> labels) {
    final normalized = _normalize(value);
    if (normalized.isEmpty) {
      return null;
    }

    return labels[normalized];
  }

  static bool _looksTechnical(String value) {
    return value.contains('_') ||
        value.contains('.') ||
        value.contains(':') ||
        value.startsWith('score ') ||
        value.startsWith('reason ');
  }

  static String _normalize(String? value) {
    return value?.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ') ?? '';
  }

  static String _normalizeField(String? value) {
    return value
            ?.trim()
            .toLowerCase()
            .replaceAll(RegExp(r'[^a-z0-9]'), '') ??
        '';
  }
}

const _categoryLabels = {
  'soft drinks': (ru: 'Газированные напитки', kk: 'Газдалған сусындар'),
  'soda': (ru: 'Газированные напитки', kk: 'Газдалған сусындар'),
  'beverages': (ru: 'Напитки', kk: 'Сусындар'),
  'drinks': (ru: 'Напитки', kk: 'Сусындар'),
  'water': (ru: 'Вода', kk: 'Су'),
  'dairy': (ru: 'Молочные продукты', kk: 'Сүт өнімдері'),
  'snacks': (ru: 'Снеки', kk: 'Снэктер'),
};

const _ingredientLabels = {
  'carbonated water': (ru: 'Газированная вода', kk: 'Газдалған су'),
  'sugar': (ru: 'Сахар', kk: 'Қант'),
  'phosphoric acid': (ru: 'Фосфорная кислота', kk: 'Фосфор қышқылы'),
  'natural flavourings': (
    ru: 'Натуральные ароматизаторы',
    kk: 'Табиғи хош иістендіргіштер',
  ),
  'natural flavorings': (
    ru: 'Натуральные ароматизаторы',
    kk: 'Табиғи хош иістендіргіштер',
  ),
  'caffeine': (ru: 'Кофеин', kk: 'Кофеин'),
  'кофеин': (ru: 'Кофеин', kk: 'Кофеин'),
  'газированная вода': (ru: 'Газированная вода', kk: 'Газдалған су'),
  'фосфорная кислота': (ru: 'Фосфорная кислота', kk: 'Фосфор қышқылы'),
  'фосфорная кислота (e338)': (
    ru: 'Фосфорная кислота (E338)',
    kk: 'Фосфор қышқылы (E338)',
  ),
  'натуральные ароматизаторы': (
    ru: 'Натуральные ароматизаторы',
    kk: 'Табиғи хош иістендіргіштер',
  ),
  'карамельный краситель e150d': (
    ru: 'Карамельный краситель E150d',
    kk: 'Карамельді бояғыш E150d',
  ),
  'colour caramel e150d': (
    ru: 'Краситель карамельный E150d',
    kk: 'Карамельді бояғыш E150d',
  ),
  'color caramel e150d': (
    ru: 'Краситель карамельный E150d',
    kk: 'Карамельді бояғыш E150d',
  ),
};

const _insightLabels = {
  'high_sugar': (ru: 'Высокое содержание сахара', kk: 'Қант мөлшері жоғары'),
  'high_salt': (ru: 'Высокое содержание соли', kk: 'Тұз мөлшері жоғары'),
  'high_saturated_fat': (
    ru: 'Высокое содержание насыщенных жиров',
    kk: 'Қаныққан май мөлшері жоғары',
  ),
  'high_energy': (
    ru: 'Высокая энергетическая ценность',
    kk: 'Энергетикалық құндылығы жоғары',
  ),
  'contains_non_sugar_sweeteners': (
    ru: 'Содержит некалорийные подсластители',
    kk: 'Некалориялық тәттілендіргіштер бар',
  ),
  'non_sugar_sweeteners': (
    ru: 'Содержит некалорийные подсластители',
    kk: 'Некалориялық тәттілендіргіштер бар',
  ),
  'low_favorable_components': (
    ru: 'Мало благоприятных пищевых компонентов',
    kk: 'Пайдалы тағамдық компоненттер аз',
  ),
  'low_favorable_nutritional_components':
      (ru: 'Мало благоприятных пищевых компонентов', kk: 'Пайдалы тағамдық компоненттер аз'),
  'high_fiber': (ru: 'Есть пищевые волокна', kk: 'Тағамдық талшықтар бар'),
  'good_fiber': (ru: 'Есть пищевые волокна', kk: 'Тағамдық талшықтар бар'),
  'high_protein': (ru: 'Источник белка', kk: 'Ақуыз көзі'),
  'good_protein': (ru: 'Источник белка', kk: 'Ақуыз көзі'),
  'fruit_vegetable_legume_content': (
    ru: 'Есть доля фруктов, овощей или бобовых',
    kk: 'Жеміс, көкөніс немесе бұршақ үлесі бар',
  ),
  'official_nutri_score_foundation': (
    ru: 'Оценка основана на методике Nutri-Score',
    kk: 'Баға Nutri-Score әдістемесіне негізделген',
  ),
  'conservative_additive_assessment': (
    ru: 'Добавки учтены как информационный фактор',
    kk: 'Қоспалар ақпараттық фактор ретінде ескерілді',
  ),
  'verified_product_data': (ru: 'Данные продукта проверены', kk: 'Өнім деректері тексерілген'),
  'community_product_data': (
    ru: 'Данные добавлены сообществом',
    kk: 'Деректерді қауымдастық қосты',
  ),
  'unverified_product_data': (
    ru: 'Данные продукта требуют проверки',
    kk: 'Өнім деректері тексеруді қажет етеді',
  ),
  'missing_tazascore_input': (
    ru: 'Недостаточно данных для TazaScore',
    kk: 'TazaScore үшін деректер жеткіліксіз',
  ),
  'partial_nutrition_foundation': (
    ru: 'Оценка рассчитана по неполным данным продукта',
    kk: 'Баға өнімнің толық емес деректері бойынша есептелді',
  ),
  'partial_data_confidence_limit': (ru: 'Данные продукта неполные', kk: 'Өнім деректері толық емес'),
  'low_nutrition_coverage': (ru: 'Покрытие данных ограничено', kk: 'Деректер қамтылуы шектеулі'),
  'missing_critical_negative_field': (
    ru: 'Не хватает важных данных о пищевой ценности',
    kk: 'Тағамдық құндылық туралы маңызды деректер жоқ',
  ),
  'partial_score_cap_applied': (
    ru: 'Применено ограничение от завышенной оценки',
    kk: 'Бағаның шамадан тыс жоғары болмауы үшін шектеу қолданылды',
  ),
  'beverage_official_metadata_cap': (
    ru: 'Для напитка не хватает части данных',
    kk: 'Сусын үшін кейбір деректер жоқ',
  ),
  'high sugar content.': (ru: 'Высокое содержание сахара', kk: 'Қант мөлшері жоғары'),
  'high sugar content': (ru: 'Высокое содержание сахара', kk: 'Қант мөлшері жоғары'),
  'high sugars content.': (ru: 'Высокое содержание сахара', kk: 'Қант мөлшері жоғары'),
  'high sugars content': (ru: 'Высокое содержание сахара', kk: 'Қант мөлшері жоғары'),
  'low salt.': (ru: 'Низкое содержание соли', kk: 'Тұз мөлшері төмен'),
  'low salt': (ru: 'Низкое содержание соли', kk: 'Тұз мөлшері төмен'),
  'low saturated fat.': (
    ru: 'Низкое содержание насыщенных жиров',
    kk: 'Қаныққан май мөлшері төмен',
  ),
  'low saturated fat': (
    ru: 'Низкое содержание насыщенных жиров',
    kk: 'Қаныққан май мөлшері төмен',
  ),
  'high saturated fat.': (
    ru: 'Высокое содержание насыщенных жиров',
    kk: 'Қаныққан май мөлшері жоғары',
  ),
  'high saturated fat': (
    ru: 'Высокое содержание насыщенных жиров',
    kk: 'Қаныққан май мөлшері жоғары',
  ),
  'insufficient data': (ru: 'Недостаточно данных', kk: 'Деректер жеткіліксіз'),
  'insufficient_data': (ru: 'Недостаточно данных', kk: 'Деректер жеткіліксіз'),
  'requires review': (ru: 'Требуется проверка', kk: 'Тексеру қажет'),
  'requires_review': (ru: 'Требуется проверка', kk: 'Тексеру қажет'),
  'calculated': (ru: 'Рассчитано', kk: 'Есептелді'),
};

const _missingFieldLabels = {
  'energykcal': (ru: 'Калорийность', kk: 'Калориялылық'),
  'energy_kcal': (ru: 'Калорийность', kk: 'Калориялылық'),
  'protein': (ru: 'Белки', kk: 'Ақуыз'),
  'carbohydrates': (ru: 'Углеводы', kk: 'Көмірсулар'),
  'sugars': (ru: 'Сахар', kk: 'Қант'),
  'fat': (ru: 'Жиры', kk: 'Май'),
  'saturatedfat': (ru: 'Насыщенные жиры', kk: 'Қаныққан майлар'),
  'saturated_fat': (ru: 'Насыщенные жиры', kk: 'Қаныққан майлар'),
  'fiber': (ru: 'Клетчатка', kk: 'Тағамдық талшықтар'),
  'salt': (ru: 'Соль', kk: 'Тұз'),
  'fruitvegetablelegumepercent': (
    ru: 'Доля фруктов, овощей и бобовых',
    kk: 'Жеміс, көкөніс және бұршақ үлесі',
  ),
  'fruit_vegetable_legume_percent': (
    ru: 'Доля фруктов, овощей и бобовых',
    kk: 'Жеміс, көкөніс және бұршақ үлесі',
  ),
  'containsnonsugarsweeteners': (
    ru: 'Наличие некалорийных подсластителей',
    kk: 'Некалориялық тәттілендіргіштердің болуы',
  ),
  'contains_non_sugar_sweeteners': (
    ru: 'Наличие некалорийных подсластителей',
    kk: 'Некалориялық тәттілендіргіштердің болуы',
  ),
};
