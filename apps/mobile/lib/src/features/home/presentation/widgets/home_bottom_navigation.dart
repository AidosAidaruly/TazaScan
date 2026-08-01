import 'package:flutter/material.dart';
import 'package:project/src/core/router/app_router.dart';

class HomeBottomNavigation extends StatelessWidget {
  const HomeBottomNavigation({required this.onScanSelected, super.key});

  final VoidCallback onScanSelected;

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
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
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.qr_code_scanner_outlined),
          selectedIcon: Icon(Icons.qr_code_scanner),
          label: 'Scan',
        ),
        NavigationDestination(
          icon: Icon(Icons.favorite_border),
          selectedIcon: Icon(Icons.favorite),
          label: 'Favorites',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: 'Profile',
        ),
      ],
    );
  }
}
