import 'package:flutter/material.dart';

class HomeActionButton extends StatelessWidget {
  const HomeActionButton.filled({
    required this.icon,
    required this.label,
    required this.onPressed,
    super.key,
  }) : isPrimary = true;

  const HomeActionButton.outlined({
    required this.icon,
    required this.label,
    required this.onPressed,
    super.key,
  }) : isPrimary = false;

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon),
        const SizedBox(width: 10),
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
      ],
    );

    if (isPrimary) {
      return FilledButton(onPressed: onPressed, child: content);
    }

    return OutlinedButton(onPressed: onPressed, child: content);
  }
}
