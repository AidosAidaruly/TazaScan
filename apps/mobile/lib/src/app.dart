import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:project/src/core/constants/app_constants.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/theme/app_theme.dart';

class ProjectApp extends StatefulWidget {
  const ProjectApp({super.key});

  @override
  State<ProjectApp> createState() => _ProjectAppState();
}

class _ProjectAppState extends State<ProjectApp> {
  late final Future<TazaLocaleController> _controllerFuture =
      TazaLocaleController.load();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<TazaLocaleController>(
      future: _controllerFuture,
      builder: (context, snapshot) {
        final controller =
            snapshot.data ?? TazaLocaleController(initialLocale: TazaLocale.ru);

        return TazaLocalizationScope(
          controller: controller,
          child: AnimatedBuilder(
            animation: controller,
            builder: (context, _) {
              return MaterialApp(
                title: AppConstants.appName,
                debugShowCheckedModeBanner: false,
                locale: controller.flutterLocale,
                supportedLocales: const [
                  Locale('ru'),
                  Locale('kk'),
                ],
                localizationsDelegates: const [
                  GlobalMaterialLocalizations.delegate,
                  GlobalWidgetsLocalizations.delegate,
                  GlobalCupertinoLocalizations.delegate,
                ],
                theme: AppTheme.light,
                darkTheme: AppTheme.dark,
                themeMode: ThemeMode.dark,
                initialRoute: AppRoutes.splash,
                onGenerateRoute: AppRouter.onGenerateRoute,
              );
            },
          ),
        );
      },
    );
  }
}
