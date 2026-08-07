import 'package:flutter/material.dart';

class ProductDisclaimer extends StatelessWidget {
  const ProductDisclaimer({super.key});

  @override
  Widget build(BuildContext context) {
    return Text(
      'Оценка носит информационный характер и не является медицинской рекомендацией. Всегда сверяйте данные с упаковкой продукта.',
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }
}
