import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _chooseLanguage(BuildContext context) async {
    final controller = context.tazaLocaleController;
    final selected = await showModalBottomSheet<TazaLocale>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        final t = context.t;

        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: Text(t.russian),
                trailing: controller.locale == TazaLocale.ru
                    ? const Icon(Icons.check_rounded)
                    : null,
                onTap: () => Navigator.of(context).pop(TazaLocale.ru),
              ),
              ListTile(
                title: Text(t.kazakh),
                trailing: controller.locale == TazaLocale.kk
                    ? const Icon(Icons.check_rounded)
                    : null,
                onTap: () => Navigator.of(context).pop(TazaLocale.kk),
              ),
            ],
          ),
        );
      },
    );

    if (selected != null) {
      await controller.setLocale(selected);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final currentLanguage =
        context.tazaLocaleController.locale == TazaLocale.kk
            ? t.kazakh
            : t.russian;

    return Scaffold(
      appBar: AppBar(title: Text(t.settings)),
      body: ResponsivePage(
        child: ListView(
          children: [
            ListTile(
              leading: const Icon(Icons.info_outline_rounded),
              title: Text(t.pick(ru: 'О TazaScan', kk: 'TazaScan туралы')),
              onTap: () => Navigator.of(context).pushNamed(AppRoutes.about),
            ),
            ListTile(
              leading: const Icon(Icons.privacy_tip_outlined),
              title: Text(
                t.pick(
                  ru: 'Политика конфиденциальности',
                  kk: 'Құпиялық саясаты',
                ),
              ),
              onTap: () => Navigator.of(context).pushNamed(AppRoutes.privacy),
            ),
            ListTile(
              leading: const Icon(Icons.description_outlined),
              title: Text(
                t.pick(ru: 'Условия использования', kk: 'Пайдалану шарттары'),
              ),
              onTap: () => Navigator.of(context).pushNamed(AppRoutes.terms),
            ),
            ListTile(
              leading: const Icon(Icons.language_rounded),
              title: Text(t.language),
              subtitle: Text(currentLanguage),
              onTap: () => _chooseLanguage(context),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: Text(
                t.pick(
                  ru: 'Аккаунты пока недоступны',
                  kk: 'Аккаунттар әзірге қолжетімсіз',
                ),
              ),
              subtitle: Text(
                t.pick(
                  ru: 'История и избранное хранятся на этом устройстве.',
                  kk: 'Тарих пен таңдаулылар осы құрылғыда сақталады.',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
