import 'package:flutter/material.dart';

enum IngredientTone { warning, info, neutral }

class IngredientPresentationInfo {
  const IngredientPresentationInfo({
    required this.displayName,
    required this.explanation,
    required this.tone,
    this.semanticLabel,
    this.additiveCode,
    this.additiveDescription,
  });

  final String displayName;
  final String explanation;
  final IngredientTone tone;
  final String? semanticLabel;
  final String? additiveCode;
  final String? additiveDescription;

  bool get isAdditive => additiveCode != null && additiveDescription != null;
}

class IngredientKnowledgeMap {
  const IngredientKnowledgeMap._();

  static IngredientPresentationInfo? explain(
    String rawIngredient, {
    required bool highSugar,
  }) {
    final key = _normalize(rawIngredient);
    final rule = _rules[key];
    if (rule == null) {
      return null;
    }

    if (rule.type == _IngredientType.sugar) {
      return IngredientPresentationInfo(
        displayName: rule.displayName,
        explanation: rule.explanation,
        tone: highSugar ? IngredientTone.warning : IngredientTone.neutral,
        semanticLabel: highSugar
            ? 'Высокое содержание сахара учитывается в пищевой оценке.'
            : null,
      );
    }

    return IngredientPresentationInfo(
      displayName: rule.displayName,
      explanation: rule.explanation,
      tone: rule.tone,
      additiveCode: rule.additiveCode,
      additiveDescription: rule.additiveDescription,
    );
  }

  static String displayName(String rawIngredient) {
    return explain(rawIngredient, highSugar: false)?.displayName ??
        _knownDisplayNames[_normalize(rawIngredient)] ??
        rawIngredient;
  }

  static Color toneColor(IngredientTone tone) {
    return switch (tone) {
      IngredientTone.warning => const Color(0xFFF59E42),
      IngredientTone.info => const Color(0xFF1677FF),
      IngredientTone.neutral => const Color(0xFFA7B4C5),
    };
  }

  static String _normalize(String value) {
    return value.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
  }
}

enum _IngredientType { regular, sugar }

class _IngredientRule {
  const _IngredientRule({
    required this.displayName,
    required this.explanation,
    required this.tone,
    this.type = _IngredientType.regular,
    this.additiveCode,
    this.additiveDescription,
  });

  final String displayName;
  final String explanation;
  final IngredientTone tone;
  final _IngredientType type;
  final String? additiveCode;
  final String? additiveDescription;
}

const _rules = {
  'sugar': _IngredientRule(
    displayName: 'Сахар',
    explanation: 'Источник добавленных сахаров.',
    tone: IngredientTone.warning,
    type: _IngredientType.sugar,
  ),
  'сахар': _IngredientRule(
    displayName: 'Сахар',
    explanation: 'Источник добавленных сахаров.',
    tone: IngredientTone.warning,
    type: _IngredientType.sugar,
  ),
  'caffeine': _IngredientRule(
    displayName: 'Кофеин',
    explanation:
        'Стимулирующее вещество, естественно присутствующее или добавляемое в некоторые напитки.',
    tone: IngredientTone.info,
  ),
  'кофеин': _IngredientRule(
    displayName: 'Кофеин',
    explanation:
        'Стимулирующее вещество, естественно присутствующее или добавляемое в некоторые напитки.',
    tone: IngredientTone.info,
  ),
  'phosphoric acid': _IngredientRule(
    displayName: 'Фосфорная кислота (E338)',
    explanation: 'Регулятор кислотности.',
    tone: IngredientTone.info,
    additiveCode: 'E338',
    additiveDescription: 'регулятор кислотности',
  ),
  'e338': _IngredientRule(
    displayName: 'Фосфорная кислота (E338)',
    explanation: 'Регулятор кислотности.',
    tone: IngredientTone.info,
    additiveCode: 'E338',
    additiveDescription: 'регулятор кислотности',
  ),
  'colour caramel e150d': _IngredientRule(
    displayName: 'Карамельный краситель E150d',
    explanation: 'Пищевой краситель.',
    tone: IngredientTone.info,
    additiveCode: 'E150d',
    additiveDescription: 'карамельный краситель',
  ),
  'caramel colour e150d': _IngredientRule(
    displayName: 'Карамельный краситель E150d',
    explanation: 'Пищевой краситель.',
    tone: IngredientTone.info,
    additiveCode: 'E150d',
    additiveDescription: 'карамельный краситель',
  ),
  'e150d': _IngredientRule(
    displayName: 'Карамельный краситель E150d',
    explanation: 'Пищевой краситель.',
    tone: IngredientTone.info,
    additiveCode: 'E150d',
    additiveDescription: 'карамельный краситель',
  ),
  'carbonated water': _IngredientRule(
    displayName: 'Газированная вода',
    explanation: 'Вода, насыщенная углекислым газом.',
    tone: IngredientTone.neutral,
  ),
  'natural flavourings': _IngredientRule(
    displayName: 'Натуральные ароматизаторы',
    explanation: 'Используются для формирования вкуса и аромата продукта.',
    tone: IngredientTone.neutral,
  ),
  'natural flavorings': _IngredientRule(
    displayName: 'Натуральные ароматизаторы',
    explanation: 'Используются для формирования вкуса и аромата продукта.',
    tone: IngredientTone.neutral,
  ),
  'e330': _IngredientRule(
    displayName: 'Лимонная кислота (E330)',
    explanation: 'Регулятор кислотности.',
    tone: IngredientTone.info,
    additiveCode: 'E330',
    additiveDescription: 'регулятор кислотности',
  ),
  'e202': _IngredientRule(
    displayName: 'Сорбат калия (E202)',
    explanation: 'Консервант.',
    tone: IngredientTone.info,
    additiveCode: 'E202',
    additiveDescription: 'консервант',
  ),
  'e211': _IngredientRule(
    displayName: 'Бензоат натрия (E211)',
    explanation: 'Консервант.',
    tone: IngredientTone.info,
    additiveCode: 'E211',
    additiveDescription: 'консервант',
  ),
};

const _knownDisplayNames = {
  'carbonated water': 'Газированная вода',
  'sugar': 'Сахар',
  'phosphoric acid': 'Фосфорная кислота',
  'natural flavourings': 'Натуральные ароматизаторы',
  'natural flavorings': 'Натуральные ароматизаторы',
  'caffeine': 'Кофеин',
  'colour caramel e150d': 'Краситель карамельный E150d',
  'color caramel e150d': 'Краситель карамельный E150d',
};
