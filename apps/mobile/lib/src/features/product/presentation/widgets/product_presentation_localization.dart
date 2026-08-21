class ProductPresentationLocalization {
  const ProductPresentationLocalization._();

  static String category(String? value) {
    return _mapKnown(value, _categoryLabels) ?? value?.trim() ?? '';
  }

  static String ingredient(String value) {
    return _mapKnown(value, _ingredientLabels) ?? value;
  }

  static String insight(String value) {
    final mapped = _mapKnown(value, _insightLabels);
    if (mapped != null) {
      return mapped;
    }

    final normalized = _normalize(value);
    if (normalized.isEmpty || _looksTechnical(normalized)) {
      return 'Оценка рассчитана по доступным данным продукта.';
    }

    return value;
  }

  static String dataStatus(String status) {
    return switch (_normalize(status)) {
      'verified' => 'Проверено',
      'unverified' => 'Требуется проверка',
      'community' => 'Данные сообщества',
      'calculated' => 'Рассчитано',
      'insufficient data' || 'insufficient_data' => 'Недостаточно данных',
      'requires review' || 'requires_review' => 'Требуется проверка',
      _ => 'Неизвестно',
    };
  }

  static String missingField(String value) {
    return switch (_normalizeField(value)) {
      'energykcal' || 'energykcalorenergykj' || 'energykj' => 'Энергия',
      'protein' => 'Белки',
      'carbohydrates' => 'Углеводы',
      'sugars' => 'Сахар',
      'fat' => 'Жиры',
      'saturatedfat' || 'saturatedfatapproximation' => 'Насыщенные жиры',
      'fiber' => 'Клетчатка',
      'salt' => 'Соль',
      'fruitvegetablelegumepercent' => 'Доля фруктов/овощей/бобовых',
      'containsnonsugarsweeteners' => 'Некалорийные подсластители',
      _ => _mapKnown(value, _missingFieldLabels) ?? insight(value),
    };
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
  'soft drinks': 'Газированные напитки',
  'soda': 'Газированные напитки',
  'beverages': 'Напитки',
  'drinks': 'Напитки',
  'water': 'Вода',
  'dairy': 'Молочные продукты',
  'snacks': 'Снеки',
};

const _ingredientLabels = {
  'carbonated water': 'Газированная вода',
  'sugar': 'Сахар',
  'phosphoric acid': 'Фосфорная кислота',
  'natural flavourings': 'Натуральные ароматизаторы',
  'natural flavorings': 'Натуральные ароматизаторы',
  'caffeine': 'Кофеин',
  'colour caramel e150d': 'Краситель карамельный E150d',
  'color caramel e150d': 'Краситель карамельный E150d',
};

const _insightLabels = {
  'high_sugar': 'Много сахара',
  'high_salt': 'Много соли',
  'high_saturated_fat': 'Много насыщенных жиров',
  'high_energy': 'Высокая калорийность',
  'contains_non_sugar_sweeteners': 'Содержит некалорийные подсластители',
  'non_sugar_sweeteners': 'Содержит некалорийные подсластители',
  'low_favorable_components': 'Мало благоприятных пищевых компонентов',
  'low_favorable_nutritional_components':
      'Мало благоприятных пищевых компонентов',
  'high_fiber': 'Есть пищевые волокна',
  'good_fiber': 'Есть пищевые волокна',
  'high_protein': 'Источник белка',
  'good_protein': 'Источник белка',
  'fruit_vegetable_legume_content':
      'Есть доля фруктов, овощей или бобовых',
  'official_nutri_score_foundation':
      'Оценка основана на методике Nutri-Score',
  'conservative_additive_assessment':
      'Добавки учтены как информационный фактор',
  'verified_product_data': 'Данные продукта проверены',
  'community_product_data': 'Данные добавлены сообществом',
  'unverified_product_data': 'Данные продукта требуют проверки',
  'missing_tazascore_input': 'Недостаточно данных для TazaScore',
  'partial_nutrition_foundation':
      'Оценка рассчитана по неполным данным продукта',
  'partial_data_confidence_limit': 'Данные продукта неполные',
  'low_nutrition_coverage': 'Покрытие данных ограничено',
  'missing_critical_negative_field':
      'Не хватает важных данных о пищевой ценности',
  'partial_score_cap_applied':
      'Применено ограничение от завышенной оценки',
  'beverage_official_metadata_cap':
      'Для напитка не хватает части данных',
  'high sugar content.': 'Много сахара',
  'high sugar content': 'Много сахара',
  'high sugars content.': 'Много сахара',
  'high sugars content': 'Много сахара',
  'low salt.': 'Низкое содержание соли',
  'low salt': 'Низкое содержание соли',
  'low saturated fat.': 'Низкое содержание насыщенных жиров',
  'low saturated fat': 'Низкое содержание насыщенных жиров',
  'high saturated fat.': 'Много насыщенных жиров',
  'high saturated fat': 'Много насыщенных жиров',
  'insufficient data': 'Недостаточно данных',
  'insufficient_data': 'Недостаточно данных',
  'requires review': 'Требуется проверка',
  'requires_review': 'Требуется проверка',
  'calculated': 'Рассчитано',
};

const _missingFieldLabels = {
  'energykcal': 'Калорийность',
  'energy_kcal': 'Калорийность',
  'protein': 'Белки',
  'carbohydrates': 'Углеводы',
  'sugars': 'Сахар',
  'fat': 'Жиры',
  'saturatedfat': 'Насыщенные жиры',
  'saturated_fat': 'Насыщенные жиры',
  'fiber': 'Клетчатка',
  'salt': 'Соль',
  'fruitvegetablelegumepercent': 'Доля фруктов, овощей и бобовых',
  'fruit_vegetable_legume_percent': 'Доля фруктов, овощей и бобовых',
  'containsnonsugarsweeteners': 'Наличие некалорийных подсластителей',
  'contains_non_sugar_sweeteners': 'Наличие некалорийных подсластителей',
};
