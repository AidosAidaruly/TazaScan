import 'package:flutter/material.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Настройки')),
      body: ResponsivePage(
        child: ListView(
          children: [
            ListTile(
              leading: const Icon(Icons.info_outline_rounded),
              title: const Text('О TazaScan'),
              onTap: () => Navigator.of(context).pushNamed(AppRoutes.about),
            ),
            ListTile(
              leading: const Icon(Icons.privacy_tip_outlined),
              title: const Text('Политика конфиденциальности'),
              onTap: () => Navigator.of(context).pushNamed(AppRoutes.privacy),
            ),
            ListTile(
              leading: const Icon(Icons.description_outlined),
              title: const Text('Условия использования'),
              onTap: () => Navigator.of(context).pushNamed(AppRoutes.terms),
            ),
            const Divider(),
            const ListTile(
              leading: Icon(Icons.person_outline),
              title: Text('Аккаунты пока недоступны'),
              subtitle: Text(
                'История и избранное хранятся на этом устройстве.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
