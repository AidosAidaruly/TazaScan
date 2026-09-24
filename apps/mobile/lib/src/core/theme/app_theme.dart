import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:project/src/core/theme/app_colors.dart';

abstract final class AppTheme {
  static ThemeData get light => TazaTheme.light;
  static ThemeData get dark => TazaTheme.light;
}

abstract final class TazaTheme {
  static ThemeData get light {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.primaryGreen,
      onPrimary: Colors.white,
      primaryContainer: AppColors.softSurface,
      onPrimaryContainer: AppColors.primaryGreen,
      secondary: AppColors.primaryGreen,
      onSecondary: Colors.white,
      secondaryContainer: AppColors.softSurface,
      onSecondaryContainer: AppColors.primaryGreen,
      tertiary: AppColors.success,
      onTertiary: Colors.white,
      tertiaryContainer: Color(0xFFDCF5EB),
      onTertiaryContainer: Color(0xFF0B3B2C),
      error: AppColors.error,
      onError: Colors.white,
      errorContainer: Color(0xFFFCDDE1),
      onErrorContainer: Color(0xFF4A0710),
      surface: AppColors.background,
      onSurface: AppColors.ink,
      surfaceContainerHighest: AppColors.surface,
      onSurfaceVariant: AppColors.secondaryText,
      outline: Color(0xFFB9C2B7),
      outlineVariant: AppColors.divider,
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: AppColors.ink,
      onInverseSurface: AppColors.background,
      inversePrimary: AppColors.softSurface,
    );

    return _buildTheme(colorScheme);
  }

  static ThemeData _buildTheme(ColorScheme colorScheme) {
    final baseTextTheme = ThemeData(brightness: colorScheme.brightness).textTheme;
    final manrope = GoogleFonts.manropeTextTheme(baseTextTheme);

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colorScheme.surface,
      textTheme: manrope
          .copyWith(
            headlineLarge: manrope.headlineLarge?.copyWith(
              fontSize: 30,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
            headlineMedium: manrope.headlineMedium?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: 0,
            ),
            headlineSmall: manrope.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: 0,
            ),
            titleLarge: manrope.titleLarge?.copyWith(
              fontSize: 21,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
            titleMedium: manrope.titleMedium?.copyWith(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
            titleSmall: manrope.titleSmall?.copyWith(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
            bodyLarge: manrope.bodyLarge?.copyWith(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              letterSpacing: 0,
            ),
            bodyMedium: manrope.bodyMedium?.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              letterSpacing: 0,
            ),
            bodySmall: manrope.bodySmall?.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              letterSpacing: 0,
            ),
            labelLarge: manrope.labelLarge?.copyWith(fontWeight: FontWeight.w700),
            labelMedium: manrope.labelMedium?.copyWith(fontWeight: FontWeight.w700),
          )
          .apply(
            bodyColor: colorScheme.onSurface,
            displayColor: colorScheme.onSurface,
          ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: colorScheme.primary,
          foregroundColor: colorScheme.onPrimary,
          minimumSize: const Size.fromHeight(56),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          foregroundColor: colorScheme.primary,
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          side: BorderSide(color: colorScheme.outline.withValues(alpha: 0.6)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colorScheme.primary,
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleTextStyle: TextStyle(
          fontFamily: manrope.titleLarge?.fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: colorScheme.onSurface,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colorScheme.surfaceContainerHighest,
        indicatorColor: Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),
      dividerTheme: DividerThemeData(
        color: colorScheme.outlineVariant,
        thickness: 1,
        space: 1,
      ),
      iconTheme: IconThemeData(color: colorScheme.onSurface),
    );
  }
}
