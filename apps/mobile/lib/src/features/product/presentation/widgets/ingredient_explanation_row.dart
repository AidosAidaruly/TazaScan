import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/features/product/presentation/widgets/ingredient_knowledge_map.dart';
import 'package:project/src/features/product/presentation/widgets/product_presentation_localization.dart';

class IngredientExplanationRow extends StatelessWidget {
  const IngredientExplanationRow({required this.info, super.key});

  final IngredientPresentationInfo info;

  @override
  Widget build(BuildContext context) {
    final color = IngredientKnowledgeMap.toneColor(info.tone);
    final textTheme = Theme.of(context).textTheme;
    final secondaryColor = Theme.of(context).colorScheme.onSurfaceVariant;
    final locale = context.tazaLocaleController.locale;
    final displayName = ProductPresentationLocalization.ingredient(
      info.displayName,
      locale: locale,
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(_iconFor(info), size: 16, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  style: textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  _localizedExplanation(context, info.explanation),
                  style: textTheme.bodySmall?.copyWith(
                    color: secondaryColor,
                    height: 1.25,
                  ),
                ),
                if (info.semanticLabel != null) ...[
                  const SizedBox(height: 5),
                  Text(
                    _localizedExplanation(context, info.semanticLabel!),
                    style: textTheme.bodySmall?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w700,
                      height: 1.25,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _iconFor(IngredientPresentationInfo info) {
    if (info.displayName == 'Сахар') {
      return Icons.cookie_rounded;
    }
    if (info.displayName == 'Кофеин') {
      return Icons.bolt_rounded;
    }
    if (info.isAdditive) {
      return Icons.science_rounded;
    }
    return Icons.info_rounded;
  }

  String _localizedExplanation(BuildContext context, String value) {
    final kk = context.tazaLocaleController.locale == TazaLocale.kk;
    if (!kk) return value;

    return switch (value) {
      'Источник добавленных сахаров.' => 'Қосылған қант көзі.',
      'Высокое содержание сахара учитывается в пищевой оценке.' =>
        'Қант мөлшерінің жоғары болуы тағамдық бағалауда ескеріледі.',
      'Стимулирующее вещество, естественно присутствующее или добавляемое в некоторые напитки.' =>
        'Кейбір сусындарда табиғи түрде болатын немесе қосылатын сергіткіш зат.',
      'Регулятор кислотности.' => 'Қышқылдықты реттегіш.',
      'Пищевой краситель.' => 'Тағамдық бояғыш.',
      'Вода, насыщенная углекислым газом.' => 'Көмірқышқыл газымен қанықтырылған су.',
      'Используются для формирования вкуса и аромата продукта.' =>
        'Өнімнің дәмі мен хош иісін қалыптастыру үшін қолданылады.',
      'Консервант.' => 'Консервант.',
      _ => value,
    };
  }
}
