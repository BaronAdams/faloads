import "package:flutter/material.dart";

/// Palette approximating the oklch dark-engineering tokens from the
/// StructCalc design prototypes (`StructCalc.dc.html` / `StructCalc Mobile.dc.html`).
/// Quasi-monochrome near-black background, one confident blue accent for
/// primary actions, amber for poutres, teal for dalles/voiles, red only
/// for warnings/critical values.
class AppColors {
  AppColors._();

  static const Color background = Color(0xFF121317);
  static const Color surface = Color(0xFF191B20);
  static const Color surfaceRaised = Color(0xFF20232A);
  static const Color border = Color(0xFF2A2D35);
  static const Color borderSubtle = Color(0xFF23262D);

  static const Color textPrimary = Color(0xFFEBEDF0);
  static const Color textSecondary = Color(0xFFA0A6B2);
  static const Color textTertiary = Color(0xFF676D79);

  static const Color accentBlue = Color(0xFF5B8DEF);
  static const Color accentAmber = Color(0xFFD79A4B);
  static const Color accentTeal = Color(0xFF3FAE9C);
  static const Color danger = Color(0xFFE5555A);
  static const Color success = Color(0xFF4CAF7D);

  static const Color columnColor = accentBlue;
  static const Color beamColor = accentAmber;
  static const Color slabWallColor = accentTeal;
}
