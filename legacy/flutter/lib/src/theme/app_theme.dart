import "package:flutter/material.dart";

import "app_colors.dart";

/// Quasi-monochrome, precision-engineering theme shared by every screen, in
/// both a dark and a light variant. DM Sans for UI copy, JetBrains Mono for
/// numeric/technical values (see [monoTextStyle]). Both are bundled as local
/// assets (see pubspec.yaml's `fonts:` section) rather than fetched over the
/// network at runtime, so they render correctly offline and on first launch.
///
/// [dark]/[light] intentionally don't read from [AppColors] (whose neutral
/// tones are themselves brightness-*dependent* getters, switched by
/// main.dart to match whichever of these two themes is currently active) —
/// each is self-contained with its own literal palette, so building the
/// *other* (currently inactive) one never risks picking up the wrong
/// brightness's colors.
class AppTheme {
  AppTheme._();

  static const String uiFontFamily = "DM Sans";
  static const String monoFontFamily = "JetBrains Mono";

  static TextStyle monoTextStyle({
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.w500,
    Color? color,
  }) {
    return TextStyle(
      fontFamily: monoFontFamily,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color ?? AppColors.textPrimary,
    );
  }

  static ThemeData get dark => _build(
        brightness: Brightness.dark,
        background: const Color(0xFF121317),
        surface: const Color(0xFF191B20),
        surfaceRaised: const Color(0xFF20232A),
        border: const Color(0xFF2A2D35),
        textPrimary: const Color(0xFFEBEDF0),
        textSecondary: const Color(0xFFA0A6B2),
      );

  static ThemeData get light => _build(
        brightness: Brightness.light,
        background: const Color(0xFFF6F7F9),
        surface: const Color(0xFFFFFFFF),
        surfaceRaised: const Color(0xFFEFF1F4),
        border: const Color(0xFFDEE1E6),
        textPrimary: const Color(0xFF191B20),
        textSecondary: const Color(0xFF565C68),
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color background,
    required Color surface,
    required Color surfaceRaised,
    required Color border,
    required Color textPrimary,
    required Color textSecondary,
  }) {
    final base = ThemeData(brightness: brightness);
    final textTheme = base.textTheme.apply(
      fontFamily: uiFontFamily,
      bodyColor: textPrimary,
      displayColor: textPrimary,
    );

    return base.copyWith(
      scaffoldBackgroundColor: background,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: AppColors.accentBlue,
        onPrimary: Colors.white,
        secondary: AppColors.accentAmber,
        onSecondary: Colors.white,
        surface: surface,
        onSurface: textPrimary,
        error: AppColors.danger,
        onError: Colors.white,
      ),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        foregroundColor: textPrimary,
      ),
      dividerTheme: DividerThemeData(
        color: border,
        thickness: 1,
        space: 1,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accentBlue,
          foregroundColor: Colors.white,
          disabledBackgroundColor: surfaceRaised,
          disabledForegroundColor: textSecondary,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontFamily: uiFontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: textPrimary,
          side: BorderSide(color: border),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.accentBlue),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceRaised,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.accentBlue),
        ),
        labelStyle: TextStyle(color: textSecondary),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: surface,
        selectedItemColor: AppColors.accentBlue,
        unselectedItemColor: textSecondary,
        type: BottomNavigationBarType.fixed,
        showUnselectedLabels: true,
      ),
    );
  }
}
