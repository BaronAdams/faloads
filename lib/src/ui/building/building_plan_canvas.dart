import "dart:math" as math;

import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../theme/app_colors.dart";
import "building_state.dart";

/// Converts a floor's independent travée spans (metres) into pixel
/// positions for painting, with a fixed [padding] margin — the spec's
/// ≥60px requirement for the circled axis labels at the plan's edges.
class BuildingPlanGeometry {
  BuildingPlanGeometry({required this.floor, this.scale = 42, this.padding = 75});

  final FloorModel floor;
  final double scale;
  final double padding;

  late final List<double> xPositions = _cumulative(floor.spanXM);
  late final List<double> yPositions = _cumulative(floor.spanYM);

  List<double> _cumulative(List<double> spans) {
    final list = <double>[padding];
    for (final s in spans) {
      list.add(list.last + s * scale);
    }
    return list;
  }

  Size get contentSize => Size(xPositions.last + padding, yPositions.last + padding);
}

double _distanceToSegment(Offset p, Offset a, Offset b) {
  final ab = b - a;
  final abLenSq = ab.dx * ab.dx + ab.dy * ab.dy;
  if (abLenSq == 0) return (p - a).distance;
  var t = ((p - a).dx * ab.dx + (p - a).dy * ab.dy) / abLenSq;
  t = math.max(0.0, math.min(1.0, t));
  final proj = a + ab * t;
  return (p - proj).distance;
}

/// Interactive plan for one floor: pan + pinch-zoom via [InteractiveViewer]
/// (spec §7: "pan (glisser) et zoom (molette/pincement)"), tap-to-select
/// among nodes (poteaux), edges (poutres/voiles), and panels (dalles) —
/// only one at a time, closing whichever was selected before.
class BuildingPlanCanvas extends StatelessWidget {
  const BuildingPlanCanvas({
    super.key,
    required this.floor,
    required this.selection,
    required this.onSelect,
  });

  final FloorModel floor;
  final BuildingSelection? selection;
  final ValueChanged<BuildingSelection?> onSelect;

  @override
  Widget build(BuildContext context) {
    final geometry = BuildingPlanGeometry(floor: floor);
    return ColoredBox(
      color: AppColors.background,
      child: InteractiveViewer(
        constrained: false,
        minScale: 0.4,
        maxScale: 3,
        boundaryMargin: const EdgeInsets.all(200),
        child: GestureDetector(
          onTapUp: (details) => onSelect(_hitTest(details.localPosition, geometry)),
          child: SizedBox(
            width: geometry.contentSize.width,
            height: geometry.contentSize.height,
            child: CustomPaint(
              key: const Key("buildingPlanCanvasPaint"),
              size: geometry.contentSize,
              painter: _BuildingPlanPainter(floor: floor, geometry: geometry, selection: selection),
            ),
          ),
        ),
      ),
    );
  }

  BuildingSelection? _hitTest(Offset pos, BuildingPlanGeometry geom) {
    const nodeHitRadius = 16.0;
    const edgeHitRadius = 12.0;
    final xs = geom.xPositions;
    final ys = geom.yPositions;

    for (var c = 0; c <= floor.nx; c++) {
      for (var r = 0; r <= floor.ny; r++) {
        if ((pos - Offset(xs[c], ys[r])).distance <= nodeHitRadius) {
          return NodeSelection(c, r);
        }
      }
    }

    for (var line = 0; line <= floor.ny; line++) {
      for (var seg = 0; seg < floor.nx; seg++) {
        final a = Offset(xs[seg], ys[line]);
        final b = Offset(xs[seg + 1], ys[line]);
        if (_distanceToSegment(pos, a, b) <= edgeHitRadius) {
          return EdgeSelection((isHorizontal: true, line: line, segment: seg));
        }
      }
    }
    for (var line = 0; line <= floor.nx; line++) {
      for (var seg = 0; seg < floor.ny; seg++) {
        final a = Offset(xs[line], ys[seg]);
        final b = Offset(xs[line], ys[seg + 1]);
        if (_distanceToSegment(pos, a, b) <= edgeHitRadius) {
          return EdgeSelection((isHorizontal: false, line: line, segment: seg));
        }
      }
    }

    for (var c = 0; c < floor.nx; c++) {
      for (var r = 0; r < floor.ny; r++) {
        final rect = Rect.fromLTRB(xs[c], ys[r], xs[c + 1], ys[r + 1]);
        if (rect.contains(pos)) return PanelSelection(c, r);
      }
    }
    return null;
  }
}

class _BuildingPlanPainter extends CustomPainter {
  _BuildingPlanPainter({required this.floor, required this.geometry, required this.selection});

  final FloorModel floor;
  final BuildingPlanGeometry geometry;
  final BuildingSelection? selection;

  @override
  void paint(Canvas canvas, Size size) {
    final xs = geometry.xPositions;
    final ys = geometry.yPositions;
    final top = ys.first;
    final bottom = ys.last;
    final left = xs.first;
    final right = xs.last;

    final axisPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.5)
      ..strokeWidth = 1;
    for (var c = 0; c < xs.length; c++) {
      _drawDashedLine(canvas, Offset(xs[c], top), Offset(xs[c], bottom), axisPaint);
      _drawCircleLabel(canvas, Offset(xs[c], top - 30), columnLetter(c));
      _drawCircleLabel(canvas, Offset(xs[c], bottom + 30), columnLetter(c));
    }
    for (var r = 0; r < ys.length; r++) {
      _drawDashedLine(canvas, Offset(left, ys[r]), Offset(right, ys[r]), axisPaint);
      _drawCircleLabel(canvas, Offset(left - 30, ys[r]), "${r + 1}");
      _drawCircleLabel(canvas, Offset(right + 30, ys[r]), "${r + 1}");
    }

    for (var c = 0; c < floor.nx; c++) {
      for (var r = 0; r < floor.ny; r++) {
        final panel = floor.panels[(c, r)];
        if (panel == null || !panel.exists) continue;
        final rect = Rect.fromLTRB(xs[c], ys[r], xs[c + 1], ys[r + 1]);
        final isSelected = selection is PanelSelection && (selection as PanelSelection).col == c && (selection as PanelSelection).row == r;
        canvas.drawRect(
          rect,
          Paint()..color = isSelected ? Colors.white.withValues(alpha: 0.22) : AppColors.accentTeal.withValues(alpha: 0.12),
        );
        if (isSelected) {
          canvas.drawRect(rect, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2);
        }
        _drawCircleLabel(canvas, rect.center, panel.displayLabel, color: isSelected ? Colors.white : AppColors.accentTeal);
      }
    }

    for (var line = 0; line <= floor.ny; line++) {
      for (var seg = 0; seg < floor.nx; seg++) {
        _paintEdge(canvas, (isHorizontal: true, line: line, segment: seg), Offset(xs[seg], ys[line]), Offset(xs[seg + 1], ys[line]));
      }
    }
    for (var line = 0; line <= floor.nx; line++) {
      for (var seg = 0; seg < floor.ny; seg++) {
        _paintEdge(canvas, (isHorizontal: false, line: line, segment: seg), Offset(xs[line], ys[seg]), Offset(xs[line], ys[seg + 1]));
      }
    }

    for (var c = 0; c <= floor.nx; c++) {
      for (var r = 0; r <= floor.ny; r++) {
        _paintNode(canvas, c, r, Offset(xs[c], ys[r]));
      }
    }
  }

  void _paintEdge(Canvas canvas, BeamKey key, Offset a, Offset b) {
    final edge = floor.edges[key];
    final exists = edge?.exists ?? true;
    final type = edge?.type ?? EdgeType.poutre;
    final isSelected = selection is EdgeSelection && (selection as EdgeSelection).key == key;
    final baseColor = type == EdgeType.poutre ? AppColors.accentAmber : AppColors.accentTeal;

    if (!exists) {
      _drawDashedLine(canvas, a, b, Paint()..color = AppColors.textTertiary..strokeWidth = 2);
      return;
    }

    canvas.drawLine(a, b, Paint()..color = baseColor.withValues(alpha: 0.35)..strokeWidth = 11..strokeCap = StrokeCap.round);
    canvas.drawLine(
      a,
      b,
      Paint()
        ..color = isSelected ? Colors.white : baseColor
        ..strokeWidth = isSelected ? 6 : 5
        ..strokeCap = StrokeCap.round,
    );
  }

  void _paintNode(Canvas canvas, int col, int row, Offset center) {
    final node = floor.nodes[(col, row)];
    final exists = node?.exists ?? true;
    final isSelected = selection is NodeSelection && (selection as NodeSelection).col == col && (selection as NodeSelection).row == row;

    if (!exists) {
      final rect = Rect.fromCenter(center: center, width: 16, height: 16);
      _drawDashedRect(canvas, rect, Paint()..color = AppColors.textTertiary..strokeWidth = 1.5);
      return;
    }

    final rect = Rect.fromCenter(center: center, width: 18, height: 18);
    canvas.drawRect(rect, Paint()..color = isSelected ? Colors.white : AppColors.accentBlue);
    if (isSelected) {
      canvas.drawRect(rect.inflate(3), Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2);
    }
    _drawCenteredText(canvas, center + const Offset(0, 18), nodeLabel(col, row), AppColors.textSecondary, fontSize: 9);
  }

  void _drawDashedLine(Canvas canvas, Offset a, Offset b, Paint paint, {double dash = 5, double gap = 4}) {
    final total = (b - a).distance;
    if (total == 0) return;
    final dir = (b - a) / total;
    var covered = 0.0;
    while (covered < total) {
      final end = math.min(covered + dash, total);
      canvas.drawLine(a + dir * covered, a + dir * end, paint);
      covered += dash + gap;
    }
  }

  void _drawDashedRect(Canvas canvas, Rect rect, Paint paint) {
    _drawDashedLine(canvas, rect.topLeft, rect.topRight, paint);
    _drawDashedLine(canvas, rect.topRight, rect.bottomRight, paint);
    _drawDashedLine(canvas, rect.bottomRight, rect.bottomLeft, paint);
    _drawDashedLine(canvas, rect.bottomLeft, rect.topLeft, paint);
  }

  void _drawCircleLabel(Canvas canvas, Offset center, String text, {Color color = Colors.white}) {
    canvas.drawCircle(center, 11, Paint()..color = AppColors.background);
    canvas.drawCircle(center, 11, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 1.2);
    _drawCenteredText(canvas, center, text, color, fontSize: 11);
  }

  void _drawCenteredText(Canvas canvas, Offset center, String text, Color color, {double fontSize = 11}) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: color, fontSize: fontSize, fontWeight: FontWeight.w700)),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, center - Offset(painter.width / 2, painter.height / 2));
  }

  @override
  bool shouldRepaint(covariant _BuildingPlanPainter oldDelegate) => true;
}
