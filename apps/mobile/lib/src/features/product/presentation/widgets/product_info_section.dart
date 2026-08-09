import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/presentation/widgets/ingredient_explanation_row.dart';
import 'package:project/src/features/product/presentation/widgets/ingredient_knowledge_map.dart';

class ProductInfoSection extends StatelessWidget {
  const ProductInfoSection({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    return ProductIngredientsSection(product: product);
  }
}

class ProductIngredientsSection extends StatefulWidget {
  const ProductIngredientsSection({required this.product, super.key});

  final Product product;

  @override
  State<ProductIngredientsSection> createState() =>
      _ProductIngredientsSectionState();
}

class _ProductIngredientsSectionState extends State<ProductIngredientsSection> {
  static const _collapsedIngredientCount = 10;
  static const _collapsedExplanationCount = 5;

  bool _expanded = false;
  bool _showAllExplanations = false;

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final ingredients = product.ingredients;
    final hasIngredients = ingredients.isNotEmpty;
    final hasLongList = ingredients.length > _collapsedIngredientCount;
    final visibleIngredients = hasLongList && !_expanded
        ? ingredients.take(_collapsedIngredientCount).toList()
        : ingredients;
    final highSugar = _hasHighSugar(product);
    final explanations = _prioritizedExplanations(
      _knownExplanations(ingredients, highSugar: highSugar),
    );
    final hasManyExplanations =
        explanations.length > _collapsedExplanationCount;
    final visibleExplanations = hasManyExplanations && !_showAllExplanations
        ? explanations.take(_collapsedExplanationCount).toList()
        : explanations;
    final additives = explanations.where((info) => info.isAdditive).toList();
    final summary = _summary(
      hasIngredients: hasIngredients,
      hasAddedSugar: explanations.any((info) => info.displayName == 'Сахар'),
      hasCaffeine: explanations.any((info) => info.displayName == 'Кофеин'),
      additiveCount: additives.length,
    );

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionTitle(
            title: 'Состав',
            trailing: hasIngredients
                ? _ingredientCountLabel(ingredients.length)
                : null,
          ),
          const SizedBox(height: 12),
          if (!hasIngredients)
            _SecondaryText('Состав пока не указан.')
          else ...[
            Text(
              _ingredientSentence(visibleIngredients),
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(height: 1.35),
            ),
            if (hasLongList) ...[
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                child: Text(_expanded ? 'Скрыть' : 'Показать полностью'),
              ),
            ],
            const SizedBox(height: 18),
            const _SectionTitle(title: 'Кратко о составе'),
            const SizedBox(height: 8),
            _SummaryText(summary),
            if (explanations.isNotEmpty) ...[
              const SizedBox(height: 18),
              const _SectionTitle(title: 'Что в составе'),
              const SizedBox(height: 4),
              for (
                var index = 0;
                index < visibleExplanations.length;
                index++
              ) ...[
                IngredientExplanationRow(info: visibleExplanations[index]),
                if (index < visibleExplanations.length - 1)
                  const _SoftDivider(),
              ],
              if (hasManyExplanations) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(
                    () => _showAllExplanations = !_showAllExplanations,
                  ),
                  child: Text(_showAllExplanations ? 'Скрыть' : 'Показать все'),
                ),
              ],
            ],
            if (additives.isNotEmpty) ...[
              const SizedBox(height: 18),
              const _SectionTitle(title: 'Пищевые добавки'),
              const SizedBox(height: 6),
              _AdditiveList(additives: additives),
            ],
          ],
          const SizedBox(height: 18),
          const _SectionTitle(title: 'Аллергены'),
          const SizedBox(height: 8),
          _SecondaryText(
            'Информация об аллергенах не указана.\n'
            'При аллергии всегда проверяйте упаковку продукта.',
          ),
          if (product.dataStatus == 'unverified' ||
              product.dataStatus == 'community') ...[
            const SizedBox(height: 14),
            _DataQualityNote(status: product.dataStatus),
          ],
        ],
      ),
    );
  }

  bool _hasHighSugar(Product product) {
    final value = product.nutritionFacts['sugars'];
    return value is num && value >= 10;
  }

  List<IngredientPresentationInfo> _knownExplanations(
    List<String> ingredients, {
    required bool highSugar,
  }) {
    final seen = <String>{};
    final result = <IngredientPresentationInfo>[];

    for (final ingredient in ingredients) {
      final info = IngredientKnowledgeMap.explain(
        ingredient,
        highSugar: highSugar,
      );
      if (info == null || !seen.add(info.displayName)) {
        continue;
      }
      result.add(info);
    }

    return result;
  }

  List<IngredientPresentationInfo> _prioritizedExplanations(
    List<IngredientPresentationInfo> explanations,
  ) {
    final sorted = [...explanations];
    sorted.sort((a, b) => _priority(a).compareTo(_priority(b)));
    return sorted;
  }

  int _priority(IngredientPresentationInfo info) {
    if (info.tone == IngredientTone.warning) {
      return 0;
    }
    if (info.displayName == 'Кофеин') {
      return 1;
    }
    if (info.isAdditive) {
      return 2;
    }
    return 3;
  }

  String _summary({
    required bool hasIngredients,
    required bool hasAddedSugar,
    required bool hasCaffeine,
    required int additiveCount,
  }) {
    if (!hasIngredients) {
      return 'Состав пока не указан.\nИнформация об аллергенах не указана.';
    }

    final fragments = <String>[];
    if (hasAddedSugar) {
      fragments.add('содержит добавленный сахар');
    }
    if (hasCaffeine) {
      fragments.add('содержит кофеин');
    }
    if (additiveCount > 0) {
      fragments.add(_additiveSummaryFragment(additiveCount));
    }

    final firstSentence = fragments.isEmpty
        ? 'Известные ингредиенты перечислены ниже.'
        : '${_capitalize(_joinFragments(fragments))}.';
    return '$firstSentence\nИнформация об аллергенах не указана.';
  }

  String _ingredientSentence(List<String> ingredients) {
    final localized = ingredients
        .map(IngredientKnowledgeMap.displayName)
        .where((value) => value.trim().isNotEmpty)
        .toList();
    final sentence = localized.join(', ');
    return sentence.endsWith('.') ? sentence : '$sentence.';
  }

  String _ingredientCountLabel(int count) {
    return '$count ${_plural(count, 'ингредиент', 'ингредиента', 'ингредиентов')}';
  }

  String _additiveSummaryFragment(int count) {
    return count == 1
        ? 'обнаружена 1 пищевая добавка'
        : 'обнаружено $count ${_plural(count, 'пищевая добавка', 'пищевые добавки', 'пищевых добавок')}';
  }

  String _plural(int value, String one, String few, String many) {
    final mod10 = value % 10;
    final mod100 = value % 100;
    if (mod10 == 1 && mod100 != 11) {
      return one;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return few;
    }
    return many;
  }

  String _joinFragments(List<String> fragments) {
    if (fragments.length == 1) {
      return fragments.first;
    }
    if (fragments.length == 2) {
      return '${fragments.first} и ${fragments.last}';
    }
    return '${fragments.take(fragments.length - 1).join(', ')} и ${fragments.last}';
  }

  String _capitalize(String value) {
    if (value.isEmpty) {
      return value;
    }
    return value[0].toUpperCase() + value.substring(1);
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.trailing});

  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
        ),
        if (trailing != null)
          Text(
            trailing!,
            style: textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w700,
            ),
          ),
      ],
    );
  }
}

class _SecondaryText extends StatelessWidget {
  const _SecondaryText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
        height: 1.35,
      ),
    );
  }
}

class _SummaryText extends StatelessWidget {
  const _SummaryText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.58),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: colorScheme.onSurfaceVariant,
            height: 1.35,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _AdditiveList extends StatelessWidget {
  const _AdditiveList({required this.additives});

  final List<IngredientPresentationInfo> additives;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        for (var index = 0; index < additives.length; index++) ...[
          _AdditiveLine(
            code: additives[index].additiveCode!,
            description: additives[index].additiveDescription!,
          ),
          if (index < additives.length - 1)
            Divider(
              height: 1,
              thickness: 1,
              color: colorScheme.outlineVariant.withValues(alpha: 0.3),
            ),
        ],
      ],
    );
  }
}

class _AdditiveLine extends StatelessWidget {
  const _AdditiveLine({required this.code, required this.description});

  final String code;
  final String description;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: code,
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            TextSpan(
              text: ' — $description',
              style: TextStyle(color: colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _DataQualityNote extends StatelessWidget {
  const _DataQualityNote({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = status == 'community'
        ? const Color(0xFFF4C542)
        : Theme.of(context).colorScheme.onSurfaceVariant;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.info_outline_rounded, size: 16, color: color),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Данные требуют проверки.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _SoftDivider extends StatelessWidget {
  const _SoftDivider();

  @override
  Widget build(BuildContext context) {
    return Divider(
      height: 1,
      thickness: 1,
      color: Theme.of(
        context,
      ).colorScheme.outlineVariant.withValues(alpha: 0.3),
    );
  }
}
