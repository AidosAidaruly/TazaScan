import 'package:flutter/material.dart';
import 'package:project/src/core/constants/app_constants.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/core/widgets/tazascan_logo.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final t = context.t;

    return Scaffold(
      appBar: AppBar(title: Text(t.pick(ru: 'О TazaScan', kk: 'TazaScan туралы'))),
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
              t.pick(ru: 'Версия 1.0.0 (Beta)', kk: 'Нұсқа 1.0.0 (Beta)'),
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              t.pick(
                ru:
                    'TazaScan — приложение, которое помогает быстро понять состав и пищевую ценность продуктов питания.',
                kk:
                    'TazaScan — тағам өнімдерінің құрамы мен тағамдық құндылығын тез түсінуге көмектесетін қолданба.',
              ),
            ),
            const SizedBox(height: 14),
            Text(
              t.pick(
                ru:
                    'Отсканируйте штрихкод, найдите продукт по названию или фотографии упаковки и получите структурированную информацию о продукте, его ингредиентах и автоматически рассчитанную оценку.',
                kk:
                    'Штрихкодты сканерлеңіз, өнімді атауы немесе қаптама фотосы бойынша табыңыз және өнім, оның ингредиенттері мен автоматты есептелген бағасы туралы құрылымды ақпарат алыңыз.',
              ),
            ),
            const SizedBox(height: 24),
            Text(
              t.pick(ru: 'Основные возможности', kk: 'Негізгі мүмкіндіктер'),
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              t.pick(
                ru:
                    '• Сканирование штрихкодов\n'
                    '• Поиск по фотографии упаковки\n'
                    '• Поиск по названию продукта\n'
                    '• История последних просмотров\n'
                    '• Избранные продукты\n'
                    '• Возможность отправить новый продукт на модерацию',
                kk:
                    '• Штрихкодтарды сканерлеу\n'
                    '• Қаптама фотосы бойынша іздеу\n'
                    '• Өнім атауы бойынша іздеу\n'
                    '• Соңғы қаралған өнімдер тарихы\n'
                    '• Таңдаулы өнімдер\n'
                    '• Жаңа өнімді модерацияға жіберу мүмкіндігі',
              ),
            ),
            const SizedBox(height: 24),
            Text(
              t.pick(ru: 'Важно', kk: 'Маңызды'),
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              t.pick(
                ru:
                    'TazaScan предоставляет информацию исключительно в ознакомительных целях. Оценки рассчитываются автоматически на основе доступных данных и не являются медицинской рекомендацией, диагнозом или заключением специалиста.',
                kk:
                    'TazaScan ақпаратты тек танысу мақсатында береді. Бағалар қолжетімді деректер негізінде автоматты түрде есептеледі және медициналық ұсыныс, диагноз немесе маман қорытындысы емес.',
              ),
            ),
            const SizedBox(height: 24),
            Text(
              t.pick(
                ru: '© 2026 TazaScan\nMade with ❤️ in Kazakhstan 🇰🇿',
                kk: '© 2026 TazaScan\nҚазақстанда ❤️ жасалған 🇰🇿',
              ),
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
