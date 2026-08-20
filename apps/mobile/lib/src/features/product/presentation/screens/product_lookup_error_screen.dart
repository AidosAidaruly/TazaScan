import 'package:flutter/material.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';

class ProductLookupErrorScreen extends StatelessWidget {
  const ProductLookupErrorScreen({
    required this.title,
    required this.message,
    this.barcode,
    super.key,
  });

  final String title;
  final String message;
  final String? barcode;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Поиск продукта')),
      body: ResponsivePage(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.search_off_rounded,
                size: 56,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Попробовать снова'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.productSubmission, arguments: barcode),
                child: const Text('Добавить товар'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
