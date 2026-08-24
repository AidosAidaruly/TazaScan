import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';

class ScannerOverlay extends StatelessWidget {
  const ScannerOverlay({required this.onCancel, super.key});

  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final t = context.t;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              children: [
                IconButton.filledTonal(
                  onPressed: onCancel,
                  icon: const Icon(Icons.close_rounded),
                  tooltip: t.pick(
                    ru: 'Отменить сканирование',
                    kk: 'Сканерлеуді тоқтату',
                  ),
                ),
                const Spacer(),
                Text(
                  t.pick(ru: 'Сканирование', kk: 'Сканерлеу'),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Spacer(),
                const SizedBox(width: 48),
              ],
            ),
            const Spacer(),
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: 280,
              height: 180,
              decoration: BoxDecoration(
                border: Border.all(color: colorScheme.primary, width: 3),
                borderRadius: BorderRadius.circular(28),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              t.pick(
                ru: 'Помести штрихкод EAN или UPC внутрь рамки.',
                kk: 'EAN немесе UPC штрихкодын жақтаудың ішіне орналастыр.',
              ),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.white.withValues(alpha: 0.88),
              ),
            ),
            const Spacer(flex: 2),
          ],
        ),
      ),
    );
  }
}
