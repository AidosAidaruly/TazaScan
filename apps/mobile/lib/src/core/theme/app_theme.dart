import 'package:flutter/material.dart';
import 'package:project/src/core/theme/app_colors.dart';

abstract final class AppTheme {
  static ThemeData get light => TazaTheme.light;
  static ThemeData get dark => TazaTheme.dark;
}

abstract final class TazaTheme {
  static ThemeData get light {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.primaryBlue,
      onPrimary: Colors.white,
      primaryContainer: Color(0xFFDCEBFF),
      onPrimaryContainer: AppColors.background,
      secondary: AppColors.secondaryCyan,
      onSecondary: AppColors.background,
      secondaryContainer: Color(0xFFD9F8FC),
      onSecondaryContainer: AppColors.background,
      tertiary: AppColors.success,
      onTertiary: AppColors.background,
      tertiaryContainer: Color(0xFFD9F8EB),
      onTertiaryContainer: AppColors.background,
      error: AppColors.error,
      onError: Colors.white,
      errorContainer: Color(0xFFFFD8DE),
      onErrorContainer: Color(0xFF4A0710),
      surface: AppColors.lightBackground,
      onSurface: AppColors.background,
      surfaceContainerHighest: AppColors.lightSurface,
      onSurfaceVariant: Color(0xFF53657A),
      outline: Color(0xFF718199),
      outlineVariant: Color(0xFFD8E2EE),
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: AppColors.background,
      onInverseSurface: AppColors.primaryText,
      inversePrimary: AppColors.secondaryCyan,
    );

    return _buildTheme(colorScheme);
  }

  static ThemeData get dark {
    const colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: AppColors.primaryBlue,
      onPrimary: Colors.white,
      primaryContainer: AppColors.elevatedSurface,
      onPrimaryContainer: AppColors.primaryText,
      secondary: AppColors.secondaryCyan,
      onSecondary: Colors.white,
      secondaryContainer: Color(0xFF123B52),
      onSecondaryContainer: AppColors.primaryText,
      tertiary: AppColors.success,
      onTertiary: AppColors.background,
      tertiaryContainer: Color(0xFF153E33),
      onTertiaryContainer: AppColors.primaryText,
      error: AppColors.error,
      onError: Colors.white,
      errorContainer: Color(0xFF4B1720),
      onErrorContainer: Color(0xFFFFD8DE),
      surface: AppColors.background,
      onSurface: AppColors.primaryText,
      surfaceContainerHighest: AppColors.elevatedSurface,
      onSurfaceVariant: AppColors.secondaryText,
      outline: Color(0xFF4B5F78),
      outlineVariant: AppColors.divider,
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: AppColors.primaryText,
      onInverseSurface: AppColors.background,
      inversePrimary: AppColors.primaryBlue,
    );

    return _buildTheme(colorScheme);
  }

  static ThemeData _buildTheme(ColorScheme colorScheme) {
    final baseTextTheme = ThemeData(
      brightness: colorScheme.brightness,
    ).textTheme;

    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Manrope',
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colorScheme.surface,
      textTheme: baseTextTheme
          .copyWith(
            headlineLarge: baseTextTheme.headlineLarge?.copyWith(
              fontSize: 32,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
            titleLarge: baseTextTheme.titleLarge?.copyWith(
              fontSize: 22,
              fontWeight: FontWeight.w600,
              letterSpacing: 0,
            ),
            titleMedium: baseTextTheme.titleMedium?.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              letterSpacing: 0,
            ),
            titleSmall: baseTextTheme.titleSmall?.copyWith(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              letterSpacing: 0,
            ),
            bodyMedium: baseTextTheme.bodyMedium?.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w400,
              letterSpacing: 0,
            ),
            bodySmall: baseTextTheme.bodySmall?.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w400,
              letterSpacing: 0,
            ),
          )
          .apply(
            bodyColor: colorScheme.onSurface,
            displayColor: colorScheme.onSurface,
          ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          foregroundColor: colorScheme.primary,
          side: BorderSide(color: colorScheme.primary.withValues(alpha: 0.55)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colorScheme.surfaceContainerHighest,
        indicatorColor: Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),
    );
  }
}
