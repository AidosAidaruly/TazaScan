import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_surface_card.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

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
            'Данные продукта',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          _InfoRow(label: 'Источник данных', value: _sourceLabel(product)),
          _InfoRow(
            label: 'Статус данных',
            value: _dataStatusLabel(product.dataStatus),
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
                    'Оценка основана на подтверждённой рецептуре этого продукта.',
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

  String _sourceLabel(Product product) {
    final source = product.source?.trim();
    if (source == null || source.isEmpty) {
      return 'TazaScan';
    }

    return switch (source.toLowerCase()) {
      'open food facts' => 'Open Food Facts',
      'user_submission' => 'Заявка пользователя',
      'manual' || 'tazascan' => 'TazaScan',
      _ => source,
    };
  }

  String _dataStatusLabel(String status) {
    return switch (status.trim().toLowerCase()) {
      'verified' => 'Проверено',
      'community' => 'Данные сообщества',
      'unverified' => 'Требуется проверка',
      _ => 'Требуется проверка',
    };
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
