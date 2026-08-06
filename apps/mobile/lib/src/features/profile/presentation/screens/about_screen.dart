import 'package:flutter/material.dart';
import 'package:project/src/core/constants/app_constants.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/core/widgets/tazascan_logo.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('О TazaScan')),
      body: ResponsivePage(
        child: ListView(
          children: [
            const TazaScanLogo(size: 112),
            const SizedBox(height: 20),
            Text(
              AppConstants.appName,
              style: textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Версия 1.0.0 (Beta)',
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'TazaScan — приложение, которое помогает быстро понять состав и пищевую ценность продуктов питания.',
            ),
            const SizedBox(height: 14),
            const Text(
              'Отсканируйте штрихкод, найдите товар по названию или фотографии упаковки и получите структурированную информацию о продукте, его ингредиентах и автоматически рассчитанную оценку.',
            ),
            const SizedBox(height: 24),
            Text(
              'Основные возможности',
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              '• Сканирование штрихкодов\n'
              '• Поиск по фотографии упаковки\n'
              '• Поиск по названию продукта\n'
              '• История последних просмотров\n'
              '• Избранные продукты\n'
              '• Возможность отправить новый продукт на модерацию',
            ),
            const SizedBox(height: 24),
            Text(
              'Важно',
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'TazaScan предоставляет информацию исключительно в ознакомительных целях. Оценки рассчитываются автоматически на основе доступных данных и не являются медицинской рекомендацией, диагнозом или заключением специалиста.',
            ),
            const SizedBox(height: 24),
            Text(
              '© 2026 TazaScan\nMade with ❤️ in Kazakhstan 🇰🇿',
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
