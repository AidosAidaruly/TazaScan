import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';

class ProductDisclaimer extends StatelessWidget {
  const ProductDisclaimer({super.key});

  @override
  Widget build(BuildContext context) {
    return Text(
      context.t.pick(
        ru:
            'Оценка носит информационный характер и не является медицинской рекомендацией. Всегда сверяйте данные с упаковкой продукта.',
        kk:
            'Баға ақпараттық сипатта және медициналық ұсыныс емес. Деректерді әрқашан өнім қаптамасымен салыстырыңыз.',
      ),
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }
}
