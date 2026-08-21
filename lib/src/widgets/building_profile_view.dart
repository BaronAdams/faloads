import "dart:math" as math;

import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_theme.dart";

/// One storey's worth of data for [BuildingProfileView]: its label, storey
/// height, and the section label to print on the vertical element band
/// (e.g. "25×25" for a poteau, "20 cm" for a voile).
class ProfileLevelDrawing {
  const ProfileLevelDrawing({required this.label, required this.heightM, required this.sectionLabel});

  final String label;
  final double heightM;
  final String sectionLabel;
}

/// Which vertical element the profile draws at each storey: a slender,
/// centred poteau, or a wide voile band.
enum ProfileElementShape { column, wall }

/// Live vertical-section (coupe) of the building being modelled, stacking
/// one slab + vertical-element band per storey from top to bottom, with a
/// dimension line for the storey height and hatched ground at the base —
/// spec §4 step 3: "vue de profil du bâtiment (coupe verticale) mise à jour
/// en direct", reused for voile per spec §5 ("même structure que le
/// Poteau"). Ported from the design prototype's buildColProfileSvg().
class BuildingProfileView extends StatelessWidget {
  const BuildingProfileView({super.key, required this.levels, required this.shape, this.height = 260});

  final List<ProfileLevelDrawing> levels;
  final ProfileElementShape shape;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Vue profil", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          const SizedBox(height: 10),
          SizedBox(
            height: height,
            width: double.infinity,
            child: levels.isEmpty
                ? const SizedBox.shrink()
                : CustomPaint(painter: _ProfilePainter(levels: levels, shape: shape)),
          ),
        ],
      ),
    );
  }
}

class _ProfilePainter extends CustomPainter {
  _ProfilePainter({required this.levels, required this.shape});

  final List<ProfileLevelDrawing> levels;
  final ProfileElementShape shape;

  static const _designW = 320.0;
  static const _slabX = 44.0;
  static const _slabWidth = 220.0;
  static const _slabH = 9.0;
  static const _centerX = 154.0;
  static const _dimX = 272.0;

  @override
  void paint(Canvas canvas, Size size) {
    final bandHeights = levels.map((l) => math.max(38.0, l.heightM * 16)).toList();
    final contentH = 14 + bandHeights.fold<double>(0, (sum, h) => sum + _slabH + h) + 20;

    final scale = math.min(size.width / _designW, size.height / contentH);
    final dx = (size.width - _designW * scale) / 2;
    final dy = (size.height - contentH * scale) / 2;
    canvas.save();
    canvas.translate(dx, dy);
    canvas.scale(scale);

    final coreHalfWidth = shape == ProfileElementShape.column ? 12.0 : 60.0;
    var y = 14.0;
    for (var i = 0; i < levels.length; i++) {
      final level = levels[i];
      final bandH = bandHeights[i];

      canvas.drawRect(
        Rect.fromLTWH(_slabX, y, _slabWidth, _slabH),
        Paint()..color = AppColors.accentBlue.withValues(alpha: 0.55),
      );
      _drawText(canvas, Offset(4, y), level.label, AppColors.textTertiary, fontSize: 9);

      final coreRect = Rect.fromLTWH(_centerX - coreHalfWidth, y + _slabH, coreHalfWidth * 2, bandH);
      canvas.drawRect(coreRect, Paint()..color = AppColors.accentBlue.withValues(alpha: 0.85));
      _drawCenteredText(canvas, coreRect.center, level.sectionLabel, Colors.white, fontSize: 8.5);

      canvas.drawLine(
        Offset(_dimX, y + _slabH),
        Offset(_dimX, y + _slabH + bandH),
        Paint()
          ..color = AppColors.textTertiary
          ..strokeWidth = 1,
      );
      _drawText(canvas, Offset(_dimX + 6, y + _slabH + bandH / 2 - 5), "${level.heightM.toStringAsFixed(1)}m", AppColors.textTertiary, fontSize: 9);

      y += _slabH + bandH;
    }

    canvas.drawLine(
      Offset(0, y + 4),
      Offset(_designW, y + 4),
      Paint()
        ..color = AppColors.textSecondary
        ..strokeWidth = 2,
    );
    for (var x = 0.0; x < _designW; x += 10) {
      canvas.drawLine(
        Offset(x, y + 4),
        Offset(x + 6, y + 12),
        Paint()
          ..color = AppColors.border
          ..strokeWidth = 1,
      );
    }

    canvas.restore();
  }

  void _drawText(Canvas canvas, Offset topLeft, String text, Color color, {required double fontSize}) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: AppTheme.monoTextStyle(fontSize: fontSize, color: color)),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, topLeft);
  }

  void _drawCenteredText(Canvas canvas, Offset center, String text, Color color, {required double fontSize}) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: AppTheme.monoTextStyle(fontSize: fontSize, fontWeight: FontWeight.w700, color: color)),
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.center,
    )..layout();
    painter.paint(canvas, center - Offset(painter.width / 2, painter.height / 2));
  }

  @override
  bool shouldRepaint(covariant _ProfilePainter oldDelegate) => true;
}
