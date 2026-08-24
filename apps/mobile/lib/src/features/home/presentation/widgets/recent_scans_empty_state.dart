import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/widgets/taza_empty_state.dart';

class RecentScansEmptyState extends StatelessWidget {
  const RecentScansEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.t;

    return TazaEmptyState(
      icon: Icons.history_rounded,
      title: t.noScansYet,
      message: t.scansWillAppearHere,
    );
  }
}
