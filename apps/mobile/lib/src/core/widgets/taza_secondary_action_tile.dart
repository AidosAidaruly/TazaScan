import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_list_card.dart';

class TazaSecondaryActionTile extends StatelessWidget {
  const TazaSecondaryActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    super.key,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TazaListCard(
      icon: icon,
      title: title,
      subtitle: subtitle,
      onTap: onTap,
    );
  }
}
