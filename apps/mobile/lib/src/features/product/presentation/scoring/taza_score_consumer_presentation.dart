import 'package:flutter/material.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';

abstract final class TazaScoreConsumerPresentation {
  static String categoryLabel(int? score) {
    if (score == null) return 'нет данных';
    if (score >= 80) return 'Отличный';
    if (score >= 60) return 'Хороший';
    if (score >= 40) return 'Средний';
    if (score >= 20) return 'Низкий';
    return 'Очень низкий';
  }

  static Color colorForScore(int? score) {
    if (score == null) return const Color(0xFFA7B4C5);
    if (score >= 80) return const Color(0xFF24C78E);
    if (score >= 60) return const Color(0xFF8FD85A);
    if (score >= 40) return const Color(0xFFF4C542);
    if (score >= 20) return const Color(0xFFF59E42);
    return const Color(0xFFF45B69);
  }

  static String shortLabel(TazaScorePreviewData? data) {
    final score = data?.score;
    if (score == null || data?.status != TazaScorePreviewStatus.calculated) {
      return 'TazaScore · нет данных';
    }

    return 'TazaScore $score/100 · ${categoryLabel(score)}';
  }

  static bool shouldShowIncompleteHint(TazaScorePreviewData? data) {
    return data?.confidence == TazaScoreConfidence.low ||
        data?.isPartialData == true;
  }
}
