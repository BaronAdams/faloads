import "dart:math" as math;

import "package:flutter/material.dart";

import "../theme/app_colors.dart";

/// Small plan-view sketch of a load-bearing system option (spec §4 step 1:
/// "Choisissez le système porteur") — 4 tributary dalle quadrants around a
/// central poteau, with poutre bands overlaid when the system routes loads
/// through beams. Ported from the design prototype's buildColSystemIllus().
class SystemIllustration extends StatelessWidget {
  const SystemIllustration({super.key, required this.withBeams});

  final bool withBeams;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.infinite,
      painter: _SystemIllustrationPainter(withBeams: withBeams),
    );
  }
}

class _SystemIllustrationPainter extends CustomPainter {
  _SystemIllustrationPainter({required this.withBeams});

  final bool withBeams;

  static const _designW = 240.0;
  static const _designH = 140.0;
  static const _cx = 120.0;
  static const _cy = 70.0;
  static const _qw = 70.0;
  static const _qh = 50.0;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width / _designW, size.height / _designH);
    final dx = (size.width - _designW * scale) / 2;
    final dy = (size.height - _designH * scale) / 2;
    canvas.save();
    canvas.translate(dx, dy);
    canvas.scale(scale);

    canvas.drawRect(const Rect.fromLTWH(0, 0, _designW, _designH), Paint()..color = AppColors.background);

    const quadrantOrigins = [
      Offset(_cx - _qw - 6, _cy - _qh - 6),
      Offset(_cx + 6, _cy - _qh - 6),
      Offset(_cx - _qw - 6, _cy + 6),
      Offset(_cx + 6, _cy + 6),
    ];
    final quadFill = Paint()..color = AppColors.accentBlue.withValues(alpha: 0.10);
    final quadStroke = Paint()
      ..color = AppColors.accentBlue.withValues(alpha: 0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final origin in quadrantOrigins) {
      final rect = Rect.fromLTWH(origin.dx, origin.dy, _qw, _qh);
      canvas.drawRect(rect, quadFill);
      canvas.drawRect(rect, quadStroke);
    }

    if (withBeams) {
      canvas.drawRect(
        const Rect.fromLTWH(_cx - _qw - 6, _cy - 8, (_qw + 6) * 2, 16),
        Paint()..color = AppColors.accentAmber.withValues(alpha: 0.75),
      );
      canvas.drawRect(
        const Rect.fromLTWH(_cx - 8, _cy - _qh - 6, 16, (_qh + 6) * 2),
        Paint()..color = AppColors.accentTeal.withValues(alpha: 0.75),
      );
    }

    canvas.drawRect(const Rect.fromLTWH(_cx - 9, _cy - 9, 18, 18), Paint()..color = AppColors.accentBlue);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _SystemIllustrationPainter oldDelegate) => oldDelegate.withBeams != withBeams;
}
