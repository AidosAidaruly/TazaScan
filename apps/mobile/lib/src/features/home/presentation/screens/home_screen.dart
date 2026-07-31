import 'package:flutter/material.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/home/presentation/widgets/home_action_button.dart';
import 'package:project/src/features/home/presentation/widgets/home_bottom_navigation.dart';
import 'package:project/src/features/home/presentation/widgets/home_header.dart';
import 'package:project/src/features/home/presentation/widgets/recent_scans_empty_state.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  void _openScanner(BuildContext context) {
    Navigator.of(context).pushNamed(AppRoutes.scanner);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ResponsivePage(
        child: ListView(
          children: [
            const HomeHeader(),
            const SizedBox(height: 24),
            HomeActionButton.filled(
              icon: Icons.qr_code_scanner_rounded,
              label: 'Scan Product',
              onPressed: () => _openScanner(context),
            ),
            const SizedBox(height: 12),
            HomeActionButton.outlined(
              icon: Icons.search_rounded,
              label: 'Search Product',
              onPressed: () {},
            ),
            const SizedBox(height: 28),
            Text(
              'Recent scans',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            const RecentScansEmptyState(),
          ],
        ),
      ),
      bottomNavigationBar: HomeBottomNavigation(
        onScanSelected: () => _openScanner(context),
      ),
    );
  }
}
