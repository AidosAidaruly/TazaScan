import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/taza_empty_state.dart';

class RecentScansEmptyState extends StatelessWidget {
  const RecentScansEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return const TazaEmptyState(
      icon: Icons.history_rounded,
      title: 'Пока нет сканов',
      message: 'Когда ты отсканируешь продукты, они появятся здесь.',
    );
  }
}
