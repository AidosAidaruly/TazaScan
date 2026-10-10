import 'package:flutter/material.dart';
import 'package:project/src/core/config/api_config.dart';
import 'package:project/src/core/constants/app_constants.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/theme/app_colors.dart';
import 'package:project/src/core/widgets/tazascan_logo.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      if (ApiConfig.isMisconfigured) {
        setState(() {});
        return;
      }
      Navigator.of(context).pushReplacementNamed(AppRoutes.home);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const TazaScanLogo(size: 128),
              const SizedBox(height: 20),
              Text(
                AppConstants.appName,
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  color: colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Сканер продуктов для Казахстана',
                style: TextStyle(
                  color: colorScheme.onPrimaryContainer.withValues(alpha: 0.82),
                ),
              ),
              if (ApiConfig.baseUrlProblem case final problem?) ...[
                const SizedBox(height: 24),
                Text(
                  apiUrlProblemMessage(problem),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Startup message for an unusable API address. Never shows the URL itself.
String apiUrlProblemMessage(ApiUrlProblem problem) {
  return switch (problem) {
    ApiUrlProblem.missing => 'Не указан адрес production API.',
    ApiUrlProblem.malformed => 'Адрес API указан неверно.',
    ApiUrlProblem.notHttps =>
      'Адрес production API должен использовать HTTPS.',
    ApiUrlProblem.developmentHost =>
      'Production-сборка указывает на локальный адрес API или адрес эмулятора.',
  };
}
