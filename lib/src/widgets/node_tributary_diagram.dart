import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_theme.dart";

/// Converts a poteau node's 4 tributary spans (+ the two bordering poutres'
/// real section widths, when the système routes loads through beams) into
/// a fixed-scale pixel layout — spans genuinely proportional to each other
/// (no artificial per-quadrant clamp, which used to silently stop
/// reflecting L1-L4 once a span went past its clamp range), sized to
/// whatever the data needs; [NodeTributaryDiagram] pans/zooms over it
/// rather than squeezing it to fit a fixed frame.
class NodeTributaryGeometry {
  NodeTributaryGeometry({
    required this.l1,
    required this.l2,
    required this.l3,
    required this.l4,
    required this.beamGapXM,
    required this.beamGapYM,
    this.scale = 55,
    this.padding = 60,
  });

  /// Gauche, droite, haut, bas (spec §4 step 2 labelling), in metres.
  final double l1, l2, l3, l4;

  /// Half the bordering poutre's section width, in metres — the tributary
  /// spans start at the poutre's face (nu), not its centreline, so each
  /// quadrant sits this far out from the poteau on top of its own span.
  /// Zero when the système has no poutres (dalle bears directly on poteau).
  final double beamGapXM, beamGapYM;

  final double scale;
  final double padding;

  double get gp => l1 * scale;
  double get dp => l2 * scale;
  double get hp => l3 * scale;
  double get vp => l4 * scale;
  double get gapX => beamGapXM * scale;
  double get gapY => beamGapYM * scale;

  double get cx => padding + gapX + gp;
  double get cy => padding + gapY + hp;

  Size get contentSize => Size(
        padding * 2 + gapX * 2 + gp + dp,
        padding * 2 + gapY * 2 + hp + vp,
      );
}

/// Plan-view of a poteau's node (spec §4 step 2): the 4 tributary dalle
/// quadrants around the poteau — each labelled with its area — plus the
/// main/secondary poutre bands, drawn at their real section width and
/// starting the quadrants at the poutre's face rather than its centreline,
/// when the système porteur routes loads through beams. Pan + pinch-zoom
/// via [InteractiveViewer], matching the bâtiment complet plan. Ported
/// from the design prototype's buildNodeSvg().
class NodeTributaryDiagram extends StatelessWidget {
  const NodeTributaryDiagram({
    super.key,
    required this.l1,
    required this.l2,
    required this.l3,
    required this.l4,
    required this.withBeams,
    this.poutrePrincipaleBCm = 25,
    this.poutreSecondaireBCm = 20,
    this.height = 340,
  });

  final double l1, l2, l3, l4;
  final bool withBeams;

  /// Section widths (cm) of the two bordering poutres — only meaningful
  /// (and only used) when [withBeams] is true.
  final double poutrePrincipaleBCm, poutreSecondaireBCm;

  final double height;

  @override
  Widget build(BuildContext context) {
    final geometry = NodeTributaryGeometry(
      l1: l1,
      l2: l2,
      l3: l3,
      l4: l4,
      // cm -> m, halved: the gap on each side of the centreline is half
      // the poutre's own width.
      beamGapXM: withBeams ? poutreSecondaireBCm / 200 : 0,
      beamGapYM: withBeams ? poutrePrincipaleBCm / 200 : 0,
    );
    return Container(
      height: height,
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InteractiveViewer(
        constrained: false,
        minScale: 0.25,
        maxScale: 4,
        boundaryMargin: const EdgeInsets.all(150),
        child: SizedBox(
          width: geometry.contentSize.width,
          height: geometry.contentSize.height,
          child: CustomPaint(
            size: geometry.contentSize,
            painter: _NodeTributaryPainter(geometry: geometry, withBeams: withBeams),
          ),
        ),
      ),
    );
  }
}

class _NodeTributaryPainter extends CustomPainter {
  _NodeTributaryPainter({required this.geometry, required this.withBeams});

  final NodeTributaryGeometry geometry;
  final bool withBeams;

  @override
  void paint(Canvas canvas, Size size) {
    final g = geometry;
    final cx = g.cx;
    final cy = g.cy;

    _quadrant(canvas, Rect.fromLTWH(cx - g.gapX - g.gp, cy - g.gapY - g.hp, g.gp, g.hp), (g.l1 / 2) * (g.l3 / 2));
    _quadrant(canvas, Rect.fromLTWH(cx + g.gapX, cy - g.gapY - g.hp, g.dp, g.hp), (g.l2 / 2) * (g.l3 / 2));
    _quadrant(canvas, Rect.fromLTWH(cx - g.gapX - g.gp, cy + g.gapY, g.gp, g.vp), (g.l1 / 2) * (g.l4 / 2));
    _quadrant(canvas, Rect.fromLTWH(cx + g.gapX, cy + g.gapY, g.dp, g.vp), (g.l2 / 2) * (g.l4 / 2));

    if (withBeams) {
      canvas.drawRect(
        Rect.fromLTWH(cx - g.gapX - g.gp, cy - g.gapY, g.gapX * 2 + g.gp + g.dp, g.gapY * 2),
        Paint()..color = AppColors.accentAmber.withValues(alpha: 0.8),
      );
      canvas.drawRect(
        Rect.fromLTWH(cx - g.gapX, cy - g.gapY - g.hp, g.gapX * 2, g.gapY * 2 + g.hp + g.vp),
        Paint()..color = AppColors.accentTeal.withValues(alpha: 0.8),
      );
    }

    canvas.drawRect(Rect.fromCenter(center: Offset(cx, cy), width: 18, height: 18), Paint()..color = AppColors.accentBlue);

    _label(canvas, Offset(cx - g.gapX - g.gp / 2, g.contentSize.height - g.padding / 2), "L1");
    _label(canvas, Offset(cx + g.gapX + g.dp / 2, g.contentSize.height - g.padding / 2), "L2");
    _label(canvas, Offset(g.padding / 2, cy - g.gapY - g.hp / 2), "L3");
    _label(canvas, Offset(g.padding / 2, cy + g.gapY + g.vp / 2), "L4");
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
    _text(canvas, rect.center, "${areaM2.toStringAsFixed(1)}m²", AppColors.textSecondary, fontSize: 12.5);
  }

  void _label(Canvas canvas, Offset center, String text) {
    _text(canvas, center, text, Colors.white, fontSize: 13, bold: true);
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
