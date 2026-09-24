import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/core/widgets/taza_primary_action_card.dart';
import 'package:project/src/core/widgets/taza_quick_action_tile.dart';
import 'package:project/src/core/widgets/taza_section_header.dart';
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

  void _openProductSearch(BuildContext context) {
    Navigator.of(context).pushNamed(AppRoutes.productSearch);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;

    return Scaffold(
      body: ResponsivePage(
        child: ListView(
          scrollCacheExtent: const ScrollCacheExtent.pixels(900),
          children: [
            const HomeHeader(),
            const SizedBox(height: 20),
            _HomeSearchField(onTap: () => _openProductSearch(context)),
            const SizedBox(height: 16),
            TazaPrimaryActionCard(
              icon: Icons.qr_code_scanner_rounded,
              title: t.scanProduct,
              subtitle: t.pointCameraAtBarcode,
              onTap: () => _openScanner(context),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TazaQuickActionTile(
                    icon: Icons.photo_camera_rounded,
                    label: t.photoSearch,
                    onTap: () => _openPhotoSearch(context),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TazaQuickActionTile(
                    icon: Icons.history_rounded,
                    label: t.history,
                    onTap: () =>
                        Navigator.of(context).pushNamed(AppRoutes.history),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),
            TazaSectionHeader(
              title: t.recentScans,
              actionLabel: t.all,
              onActionTap: () =>
                  Navigator.of(context).pushNamed(AppRoutes.history),
            ),
            const SizedBox(height: 10),
            const RecentScansEmptyState(),
          ],
        ),
      ),
    );
  }
}

class _HomeSearchField extends StatelessWidget {
  const _HomeSearchField({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Material(
      color: colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          child: Row(
            children: [
              Icon(
                Icons.search_rounded,
                color: colorScheme.onSurfaceVariant,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  context.t.productSearch,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
