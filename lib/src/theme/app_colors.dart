import "package:flutter/material.dart";

/// Palette approximating the oklch dark-engineering tokens from the
/// StructCalc design prototypes (`StructCalc.dc.html` / `StructCalc Mobile.dc.html`).
/// Quasi-monochrome near-black background, one confident blue accent for
/// primary actions, amber for poutres, teal for dalles/voiles, red only
/// for warnings/critical values.
///
/// The neutral tones (background/surface/border/text) are brightness-aware
/// — [setBrightness] (called from main.dart whenever the resolved
/// `MaterialApp` brightness changes) switches every one of them at once, so
/// existing `AppColors.background` etc. call sites everywhere in the app
/// keep working unchanged and simply repaint in the other palette on the
/// next frame. The five accent colors stay fixed brand colors in both
/// modes, so anything that referenced them as a compile-time constant
/// (`const Icon(Icons.x, color: AppColors.accentBlue)`) is unaffected.
class AppColors {
  AppColors._();

  static Brightness _brightness = Brightness.dark;

  static void setBrightness(Brightness brightness) => _brightness = brightness;

  static bool get _isDark => _brightness == Brightness.dark;

  static Color get background => _isDark ? const Color(0xFF121317) : const Color(0xFFF6F7F9);
  static Color get surface => _isDark ? const Color(0xFF191B20) : const Color(0xFFFFFFFF);
  static Color get surfaceRaised => _isDark ? const Color(0xFF20232A) : const Color(0xFFEFF1F4);
  static Color get border => _isDark ? const Color(0xFF2A2D35) : const Color(0xFFDEE1E6);
  static Color get borderSubtle => _isDark ? const Color(0xFF23262D) : const Color(0xFFE9EBEF);

  static Color get textPrimary => _isDark ? const Color(0xFFEBEDF0) : const Color(0xFF191B20);
  static Color get textSecondary => _isDark ? const Color(0xFFA0A6B2) : const Color(0xFF565C68);
  static Color get textTertiary => _isDark ? const Color(0xFF676D79) : const Color(0xFF8B909C);

  static const Color accentBlue = Color(0xFF5B8DEF);
  static const Color accentAmber = Color(0xFFD79A4B);
  static const Color accentTeal = Color(0xFF3FAE9C);
  static const Color danger = Color(0xFFE5555A);
  static const Color success = Color(0xFF4CAF7D);

  static const Color columnColor = accentBlue;
  static const Color beamColor = accentAmber;
  static const Color slabWallColor = accentTeal;
}
