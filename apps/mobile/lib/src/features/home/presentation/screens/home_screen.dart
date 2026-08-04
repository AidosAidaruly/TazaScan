import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/taza_list_card.dart';
import 'package:project/src/core/widgets/taza_primary_action_card.dart';
import 'package:project/src/core/widgets/taza_section_header.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/home/presentation/widgets/home_bottom_navigation.dart';
import 'package:project/src/features/home/presentation/widgets/home_header.dart';
import 'package:project/src/features/home/presentation/widgets/recent_scans_empty_state.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  void _openScanner(BuildContext context) {
    Navigator.of(context).pushNamed(AppRoutes.scanner);
  }

  void _openPhotoSearch(BuildContext context) {
    Navigator.of(context).pushNamed(AppRoutes.photoSearch);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      extendBody: true,
      body: DecoratedBox(
        decoration: BoxDecoration(
          color: colorScheme.surface,
          gradient: RadialGradient(
            center: const Alignment(0.75, -0.95),
            radius: 1.1,
            colors: [
              colorScheme.primary.withValues(alpha: 0.08),
              colorScheme.surface,
            ],
          ),
        ),
        child: ResponsivePage(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 132),
            scrollCacheExtent: const ScrollCacheExtent.pixels(900),
            children: [
              const HomeHeader(),
              const SizedBox(height: 32),
              TazaPrimaryActionCard(
                icon: Icons.qr_code_scanner_rounded,
                title: 'Сканировать продукт',
                subtitle: 'Наведи камеру на штрихкод',
                onTap: () => _openScanner(context),
              ),
              const SizedBox(height: 18),
              TazaListCard(
                icon: Icons.photo_camera_rounded,
                title: 'Поиск по фото',
                subtitle: 'Найти продукт по изображению',
                onTap: () => _openPhotoSearch(context),
              ),
              const SizedBox(height: 18),
              TazaListCard(
                icon: Icons.search_rounded,
                title: 'Поиск продукта',
                subtitle: 'Найти по названию или штрихкоду',
                onTap: () {},
              ),
              const SizedBox(height: 18),
              TazaListCard(
                icon: Icons.history_rounded,
                title: 'История',
                subtitle: 'Посмотреть отсканированные продукты',
                onTap: () => Navigator.of(context).pushNamed(AppRoutes.history),
              ),
              const SizedBox(height: 32),
              TazaSectionHeader(
                title: 'Недавние сканы',
                actionLabel: 'Все',
                onActionTap: () =>
                    Navigator.of(context).pushNamed(AppRoutes.history),
              ),
              const SizedBox(height: 10),
              const RecentScansEmptyState(),
            ],
          ),
        ),
      ),
      bottomNavigationBar: HomeBottomNavigation(
        onScanSelected: () => _openScanner(context),
      ),
    );
  }
}
