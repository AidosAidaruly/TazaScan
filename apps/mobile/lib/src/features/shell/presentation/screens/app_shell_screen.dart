import 'package:flutter/material.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/taza_bottom_navigation.dart';
import 'package:project/src/features/favorites/presentation/screens/favorites_screen.dart';
import 'package:project/src/features/home/presentation/screens/home_screen.dart';
import 'package:project/src/features/profile/presentation/screens/profile_screen.dart';

/// Extra bottom clearance reserved for tab bodies so their content (inside
/// each screen's own SafeArea) never sits underneath the floating bottom
/// navigation capsule.
const _tabBodyBottomClearance = 100.0;

/// The persistent app-level navigation shell.
///
/// Home, Favorites and Profile live inside this single shell as tabs: an
/// [IndexedStack] swaps the body (preserving each tab's state) instead of
/// pushing a new route, and the floating [TazaBottomNavigation] is owned
/// here so it stays visible and its liquid lens simply slides to the newly
/// selected tab.
///
/// Scan is not a persisted tab — tapping it pushes the existing
/// [AppRoutes.scanner] route above the shell (which naturally hides this
/// whole shell, bottom bar included, while the camera is open) without
/// changing which tab is selected, so popping the scanner reveals the shell
/// exactly where it was.
class AppShellScreen extends StatefulWidget {
  const AppShellScreen({super.key});

  @override
  State<AppShellScreen> createState() => _AppShellScreenState();
}

class _AppShellScreenState extends State<AppShellScreen> {
  static const _scanBarIndex = 1;

  // Bar slots are Home=0, Scan=1, Favorites=2, Profile=3. Scan is a
  // transient action rather than a tab, so it is never stored here.
  int _selectedBarIndex = 0;

  static const _tabBodies = [HomeScreen(), FavoritesScreen(), ProfileScreen()];

  int get _tabBodyIndex => switch (_selectedBarIndex) {
    0 => 0,
    2 => 1,
    _ => 2,
  };

  void _onDestinationSelected(int barIndex) {
    if (barIndex == _scanBarIndex) {
      Navigator.of(context).pushNamed(AppRoutes.scanner);
      return;
    }
    if (barIndex == _selectedBarIndex) return;
    setState(() => _selectedBarIndex = barIndex);
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: MediaQuery(
              data: mediaQuery.copyWith(
                padding: mediaQuery.padding.copyWith(
                  bottom:
                      mediaQuery.padding.bottom + _tabBodyBottomClearance,
                ),
              ),
              child: IndexedStack(index: _tabBodyIndex, children: _tabBodies),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: TazaBottomNavigation(
              selectedIndex: _selectedBarIndex,
              onDestinationSelected: _onDestinationSelected,
            ),
          ),
        ],
      ),
    );
  }
}
