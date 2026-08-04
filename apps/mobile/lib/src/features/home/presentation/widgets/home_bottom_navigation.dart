import 'package:flutter/material.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/taza_bottom_navigation.dart';

class HomeBottomNavigation extends StatelessWidget {
  const HomeBottomNavigation({required this.onScanSelected, super.key});

  final VoidCallback onScanSelected;

  @override
  Widget build(BuildContext context) {
    return TazaBottomNavigation(
      selectedIndex: 0,
      onDestinationSelected: (index) {
        if (index == 1) {
          onScanSelected();
          return;
        }

        if (index == 2) {
          Navigator.of(context).pushNamed(AppRoutes.favorites);
          return;
        }

        if (index == 3) {
          Navigator.of(context).pushNamed(AppRoutes.profile);
        }
      },
    );
  }
}
