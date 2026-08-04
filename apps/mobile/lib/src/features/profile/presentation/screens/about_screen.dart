import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:project/src/core/constants/app_constants.dart';
import 'package:project/src/core/widgets/tazascan_logo.dart';
import 'package:project/src/core/widgets/responsive_page.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('О TazaScan')),
      body: ResponsivePage(
        child: FutureBuilder<PackageInfo>(
          future: PackageInfo.fromPlatform(),
          builder: (context, snapshot) {
            final version = snapshot.data == null
                ? 'Загрузка...'
                : '${snapshot.data!.version}+${snapshot.data!.buildNumber}';

            return ListView(
              children: [
                const TazaScanLogo(size: 112),
                const SizedBox(height: 20),
                Text(
                  AppConstants.appName,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                const Text('Сканер продуктов для Казахстана.'),
                const SizedBox(height: 16),
                Text('Версия: $version'),
                const SizedBox(height: 16),
                const Text(
                  'Оценки пищевой ценности носят информационный характер и не являются медицинской рекомендацией.',
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
