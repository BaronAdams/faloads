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

/// A slab panel's rectangle split into the 4 regions assigned to its
/// bordering beams by the first-bisector method (spec §6/§7): the corners
/// on each side are joined at 45° until they meet, carving a triangle out
/// of each short edge and a trapezoid out of each long edge — degenerating
/// to 4 equal triangles for a square panel.
class _PanelSplit {
  const _PanelSplit({required this.top, required this.bottom, required this.left, required this.right});

  final List<Offset> top;
  final List<Offset> bottom;
  final List<Offset> left;
  final List<Offset> right;
}

_PanelSplit _splitPanelRect(Rect rect) {
  final w = rect.width;
  final h = rect.height;
  final x0 = rect.left;
  final y0 = rect.top;
  if (w <= h) {
    final apexTop = Offset(x0 + w / 2, y0 + w / 2);
    final apexBottom = Offset(x0 + w / 2, y0 + h - w / 2);
    return _PanelSplit(
      top: [Offset(x0, y0), Offset(x0 + w, y0), apexTop],
      bottom: [Offset(x0, y0 + h), Offset(x0 + w, y0 + h), apexBottom],
      left: [Offset(x0, y0), apexTop, apexBottom, Offset(x0, y0 + h)],
      right: [Offset(x0 + w, y0), apexTop, apexBottom, Offset(x0 + w, y0 + h)],
    );
  }
  final apexLeft = Offset(x0 + h / 2, y0 + h / 2);
  final apexRight = Offset(x0 + w - h / 2, y0 + h / 2);
  return _PanelSplit(
    left: [Offset(x0, y0), Offset(x0, y0 + h), apexLeft],
    right: [Offset(x0 + w, y0), Offset(x0 + w, y0 + h), apexRight],
    top: [Offset(x0, y0), apexLeft, apexRight, Offset(x0 + w, y0)],
    bottom: [Offset(x0, y0 + h), apexLeft, apexRight, Offset(x0 + w, y0 + h)],
  );
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
    this.showInfluenceSurfaces = false,
    this.beamLoads,
  });

  final FloorModel floor;
  final BuildingSelection? selection;
  final ValueChanged<BuildingSelection?> onSelect;

  /// Résultats step only (spec §7): draws each slab panel's first-bisector
  /// split into its 4 bordering-beam regions, and highlights the region(s)
  /// feeding whichever poteau/poutre/voile/panneau is selected.
  final bool showInfluenceSurfaces;

  /// Needed to know which panels feed the currently-selected poutre/voile
  /// (its [BeamLoadResult.contributions]) — only used when
  /// [showInfluenceSurfaces] is true.
  final Map<BeamKey, BeamLoadResult>? beamLoads;

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
              painter: _BuildingPlanPainter(
                floor: floor,
                geometry: geometry,
                selection: selection,
                showInfluenceSurfaces: showInfluenceSurfaces,
                beamLoads: beamLoads,
              ),
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
  _BuildingPlanPainter({
    required this.floor,
    required this.geometry,
    required this.selection,
    this.showInfluenceSurfaces = false,
    this.beamLoads,
  });

  final FloorModel floor;
  final BuildingPlanGeometry geometry;
  final BuildingSelection? selection;
  final bool showInfluenceSurfaces;
  final Map<BeamKey, BeamLoadResult>? beamLoads;

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

    if (showInfluenceSurfaces) {
      _paintInfluenceSurfaces(canvas, xs, ys);
    } else {
      for (var c = 0; c < floor.nx; c++) {
        for (var r = 0; r < floor.ny; r++) {
          final panel = floor.panelOrDefault(c, r);
          if (!panel.exists) continue;
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

  /// Résultats-step rendering (spec §7): every panel's bisector split,
  /// coloured by each region's bordering beam material, dimmed everywhere
  /// except the region(s) feeding the current selection — plus, for a
  /// selected poteau, its tributary quarter in each adjacent panel.
  void _paintInfluenceSurfaces(Canvas canvas, List<double> xs, List<double> ys) {
    final sel = selection;
    Set<String>? highlightedSides;
    if (sel is EdgeSelection) {
      highlightedSides = <String>{};
      for (final c in beamLoads?[sel.key]?.contributions ?? const []) {
        final side = _sideForBeamKey(sel.key, c.panelCol, c.panelRow);
        if (side != null) highlightedSides.add("${c.panelCol},${c.panelRow},$side");
      }
    }
    final dimming = highlightedSides != null;

    for (var c = 0; c < floor.nx; c++) {
      for (var r = 0; r < floor.ny; r++) {
        final panel = floor.panelOrDefault(c, r);
        if (!panel.exists) continue;
        final rect = Rect.fromLTRB(xs[c], ys[r], xs[c + 1], ys[r + 1]);
        final split = _splitPanelRect(rect);

        void paintSide(List<Offset> points, BeamKey edgeKey, String side) {
          final highlighted = highlightedSides?.contains("$c,$r,$side") ?? false;
          _paintSplitRegion(canvas, points, _edgeColorFor(edgeKey), highlighted: highlighted, dimmed: dimming);
        }

        paintSide(split.top, (isHorizontal: true, line: r, segment: c), "top");
        paintSide(split.bottom, (isHorizontal: true, line: r + 1, segment: c), "bottom");
        paintSide(split.left, (isHorizontal: false, line: c, segment: r), "left");
        paintSide(split.right, (isHorizontal: false, line: c + 1, segment: r), "right");

        final isPanelSelected = sel is PanelSelection && sel.col == c && sel.row == r;
        if (isPanelSelected) {
          canvas.drawRect(rect, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2);
        }
        _drawCircleLabel(canvas, rect.center, panel.displayLabel, color: isPanelSelected ? Colors.white : AppColors.accentTeal);
      }
    }

    if (sel is NodeSelection) {
      for (final (dc, dr) in const [(-1, -1), (0, -1), (-1, 0), (0, 0)]) {
        final c = sel.col + dc;
        final r = sel.row + dr;
        if (c < 0 || c >= floor.nx || r < 0 || r >= floor.ny) continue;
        final panel = floor.panelOrDefault(c, r);
        if (!panel.exists) continue;
        final rect = Rect.fromLTRB(xs[c], ys[r], xs[c + 1], ys[r + 1]);
        final quadrant = Rect.fromPoints(Offset(xs[sel.col], ys[sel.row]), rect.center);
        canvas.drawRect(quadrant, Paint()..color = AppColors.accentBlue.withValues(alpha: 0.4));
        canvas.drawRect(quadrant, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 1.5);
      }
    }
  }

  String? _sideForBeamKey(BeamKey key, int panelCol, int panelRow) {
    if (key.isHorizontal) {
      if (key.line == panelRow) return "top";
      if (key.line == panelRow + 1) return "bottom";
    } else {
      if (key.line == panelCol) return "left";
      if (key.line == panelCol + 1) return "right";
    }
    return null;
  }

  Color _edgeColorFor(BeamKey key) {
    final type = floor.edges[key]?.type ?? EdgeType.poutre;
    return type == EdgeType.poutre ? AppColors.accentAmber : AppColors.accentTeal;
  }

  void _paintSplitRegion(Canvas canvas, List<Offset> points, Color color, {required bool highlighted, required bool dimmed}) {
    final path = Path()..addPolygon(points, true);
    final fillAlpha = highlighted ? 0.55 : (dimmed ? 0.04 : 0.16);
    final strokeAlpha = highlighted ? 0.9 : (dimmed ? 0.15 : 0.3);
    canvas.drawPath(path, Paint()..color = color.withValues(alpha: fillAlpha));
    canvas.drawPath(
      path,
      Paint()
        ..color = highlighted ? Colors.white : color.withValues(alpha: strokeAlpha)
        ..style = PaintingStyle.stroke
        ..strokeWidth = highlighted ? 1.8 : 0.8,
    );
    if (highlighted) _drawHatch(canvas, path);
  }

  void _drawHatch(Canvas canvas, Path path) {
    canvas.save();
    canvas.clipPath(path);
    final bounds = path.getBounds();
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.55)
      ..strokeWidth = 1;
    const spacing = 7.0;
    for (var d = -bounds.height; d < bounds.width; d += spacing) {
      canvas.drawLine(
        Offset(bounds.left + d, bounds.top),
        Offset(bounds.left + d + bounds.height, bounds.bottom),
        paint,
      );
    }
    canvas.restore();
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
