import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';

class ScannerLoadingOverlay extends StatelessWidget {
  const ScannerLoadingOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      color: Colors.black.withValues(alpha: 0.62),
      child: Center(
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 16),
              Text(
                context.t.pick(
                  ru: 'Считываем штрихкод...',
                  kk: 'Штрихкод оқылуда...',
                ),
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
