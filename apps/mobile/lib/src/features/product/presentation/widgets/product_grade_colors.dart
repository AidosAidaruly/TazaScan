import 'package:flutter/material.dart';

abstract final class ProductGradeColors {
  static Color colorFor(String? grade) {
    return switch (grade?.toUpperCase()) {
      'A' => const Color(0xFF24C78E),
      'B' => const Color(0xFF8FD85A),
      'C' => const Color(0xFFF4C542),
      'D' => const Color(0xFFF59E42),
      'E' => const Color(0xFFF45B69),
      _ => const Color(0xFFA7B4C5),
    };
  }
}
