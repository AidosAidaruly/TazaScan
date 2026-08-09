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
    if (normalized.isEmpty) {
      return 'Оценка рассчитана на основе доступных данных продукта.';
    }
    if (_looksTechnical(normalized)) {
      return 'Оценка рассчитана на основе доступных данных продукта.';
    }

    return value;
  }

  static String dataStatus(String status) {
    return switch (_normalize(status)) {
      'verified' => 'Проверено',
      'unverified' => 'Не проверено',
      'community' => 'Сообщество',
      'calculated' => 'Рассчитано',
      'insufficient data' || 'insufficient_data' => 'Недостаточно данных',
      'requires review' || 'requires_review' => 'Требуется проверка',
      _ => 'Неизвестно',
    };
  }

  static String missingField(String value) {
    return _mapKnown(value, _missingFieldLabels) ?? insight(value);
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
  'high sugar content.': 'Высокое содержание сахара',
  'high sugar content': 'Высокое содержание сахара',
  'high sugars content.': 'Высокое содержание сахара',
  'high sugars content': 'Высокое содержание сахара',
  'low salt.': 'Низкое содержание соли',
  'low salt': 'Низкое содержание соли',
  'low saturated fat.': 'Низкое содержание насыщенных жиров',
  'low saturated fat': 'Низкое содержание насыщенных жиров',
  'high saturated fat.': 'Высокое содержание насыщенных жиров',
  'high saturated fat': 'Высокое содержание насыщенных жиров',
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
};
