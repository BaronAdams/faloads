import "dart:math" as math;

import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_theme.dart";

/// Plan-view of a poteau's node (spec §4 step 2): the 4 tributary dalle
/// quadrants around the poteau — each labelled with its area — plus the
/// main/secondary poutre bands overlaid on top when the système porteur
/// routes loads through beams. Ported from the design prototype's
/// buildNodeSvg().
class NodeTributaryDiagram extends StatelessWidget {
  const NodeTributaryDiagram({
    super.key,
    required this.l1,
    required this.l2,
    required this.l3,
    required this.l4,
    required this.withBeams,
    this.height = 260,
  });

  /// Gauche, droite, haut, bas (spec §4 step 2 labelling).
  final double l1, l2, l3, l4;
  final bool withBeams;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(painter: _NodeTributaryPainter(l1: l1, l2: l2, l3: l3, l4: l4, withBeams: withBeams)),
      ),
    );
  }
}

class _NodeTributaryPainter extends CustomPainter {
  _NodeTributaryPainter({required this.l1, required this.l2, required this.l3, required this.l4, required this.withBeams});

  final double l1, l2, l3, l4;
  final bool withBeams;

  static const _designW = 340.0;
  static const _designH = 280.0;
  static const _cx = 170.0;
  static const _cy = 130.0;
  static const _spanScale = 20.0;

  double _clampSpan(double m) => math.max(20.0, math.min(110.0, m * _spanScale));

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width / _designW, size.height / _designH);
    final dx = (size.width - _designW * scale) / 2;
    final dy = (size.height - _designH * scale) / 2;
    canvas.save();
    canvas.translate(dx, dy);
    canvas.scale(scale);

    final gp = _clampSpan(l1);
    final dp = _clampSpan(l2);
    final hp = _clampSpan(l3);
    final vp = _clampSpan(l4);

    _quadrant(canvas, Rect.fromLTWH(_cx - gp, _cy - hp, gp, hp), (l1 / 2) * (l3 / 2));
    _quadrant(canvas, Rect.fromLTWH(_cx, _cy - hp, dp, hp), (l2 / 2) * (l3 / 2));
    _quadrant(canvas, Rect.fromLTWH(_cx - gp, _cy, gp, vp), (l1 / 2) * (l4 / 2));
    _quadrant(canvas, Rect.fromLTWH(_cx, _cy, dp, vp), (l2 / 2) * (l4 / 2));

    if (withBeams) {
      canvas.drawRect(
        Rect.fromLTWH(_cx - gp, _cy - 4, gp + dp, 8),
        Paint()..color = AppColors.accentAmber.withValues(alpha: 0.8),
      );
      canvas.drawRect(
        Rect.fromLTWH(_cx - 4, _cy - hp, 8, hp + vp),
        Paint()..color = AppColors.accentTeal.withValues(alpha: 0.8),
      );
    }

    canvas.drawRect(Rect.fromLTWH(_cx - 8, _cy - 8, 16, 16), Paint()..color = AppColors.accentBlue);

    _label(canvas, Offset(_cx - gp / 2, _designH - 14), "L1");
    _label(canvas, Offset(_cx + dp / 2, _designH - 14), "L2");
    _label(canvas, Offset(20, _cy - hp / 2), "L3");
    _label(canvas, Offset(20, _cy + vp / 2), "L4");

    canvas.restore();
  }

  void _quadrant(Canvas canvas, Rect rect, double areaM2) {
    canvas.drawRect(rect, Paint()..color = AppColors.accentBlue.withValues(alpha: 0.10));
    canvas.drawRect(
      rect,
      Paint()
        ..color = AppColors.accentBlue.withValues(alpha: 0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
    _text(canvas, rect.center, "${areaM2.toStringAsFixed(1)}m²", AppColors.textSecondary, fontSize: 11);
  }

  void _label(Canvas canvas, Offset center, String text) {
    _text(canvas, center, text, Colors.white, fontSize: 12, bold: true);
  }

  void _text(Canvas canvas, Offset center, String text, Color color, {double fontSize = 11, bool bold = false}) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: AppTheme.monoTextStyle(fontSize: fontSize, color: color, fontWeight: bold ? FontWeight.w700 : FontWeight.w500),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, center - Offset(painter.width / 2, painter.height / 2));
  }

  @override
  bool shouldRepaint(covariant _NodeTributaryPainter oldDelegate) => true;
}
