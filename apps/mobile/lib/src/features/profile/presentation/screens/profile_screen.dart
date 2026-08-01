import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/responsive_page.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: const ResponsivePage(
        child: Center(
          child: Text('Profile will be available after user accounts are added.'),
        ),
      ),
    );
  }
}
