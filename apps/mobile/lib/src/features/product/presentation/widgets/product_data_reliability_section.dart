import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/presentation/widgets/product_presentation_localization.dart';

class ProductDataReliabilitySection extends StatelessWidget {
  const ProductDataReliabilitySection({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return TazaSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.t.pick(ru: 'Данные продукта', kk: 'Өнім деректері'),
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          _InfoRow(
            label: context.t.pick(ru: 'Источник данных', kk: 'Дереккөз'),
            value: _sourceLabel(context, product),
          ),
          _InfoRow(
            label: context.t.pick(ru: 'Статус данных', kk: 'Деректер мәртебесі'),
            value: _dataStatusLabel(context, product.dataStatus),
          ),
          if (product.scoreSource == 'canonical_recipe') ...[
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  size: 16,
                  color: colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    context.t.pick(
                      ru:
                          'Оценка основана на подтверждённой рецептуре этого продукта.',
                      kk:
                          'Баға осы өнімнің расталған рецептурасына негізделген.',
                    ),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _sourceLabel(BuildContext context, Product product) {
    final source = product.source?.trim();
    if (source == null || source.isEmpty) {
      return 'TazaScan';
    }

    return switch (source.toLowerCase()) {
      'open food facts' => 'Open Food Facts',
      'user_submission' => context.t.pick(
          ru: 'Заявка пользователя',
          kk: 'Пайдаланушы өтінімі',
        ),
      'manual' || 'tazascan' => 'TazaScan',
      _ => source,
    };
  }

  String _dataStatusLabel(BuildContext context, String status) {
    return ProductPresentationLocalization.dataStatus(
      status,
      locale: context.tazaLocaleController.locale,
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}
