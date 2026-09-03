import "package:flutter/material.dart";

import "../theme/app_colors.dart";

/// The structural element (or assembly) a [StructIcon] depicts.
enum StructIconKind {
  column,
  beam,
  wall,
  slab,
  balcony,
  stairs,
  beamGrid,
  building,
  beamUdl,
  portalFrame,
  retainingWall,
  footing,
}

/// What extra cue to overlay on the glyph: dimension lines (cotes), for a
/// prédimensionnement step — "you're about to size this"; downward load
/// arrows, for a descente de charges entry — "this is what receives a
/// load"; or small rebar dots on the cut face, for a dimensionnement béton
/// armé entry — "you're about to design/verify its ferraillage".
enum StructIconAnnotation { none, dimensions, load, rebar }

/// Small 2.5D isometric glyph for a structural element — a block for a
/// poteau, an elongated bar for a poutre, a tall slab for a voile, and so
/// on — instead of a generic Material icon that doesn't actually say
/// "column" or "wall". Every box is drawn as an outline only (transparent
/// fill, coloured stroke) so it reads as a clean technical sketch rather
/// than a flat glyph. Ported from the design prototype's icon set
/// (renderIcon: 'column', 'beam', 'wall', 'building'), extended with
/// matching glyphs for the element types the prototype didn't need an
/// icon for.
class StructIcon extends StatelessWidget {
  const StructIcon({
    super.key,
    required this.kind,
    this.size = 22,
    this.color = AppColors.accentBlue,
    this.annotation = StructIconAnnotation.none,
  });

  final StructIconKind kind;
  final double size;
  final Color color;
  final StructIconAnnotation annotation;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _StructIconPainter(kind: kind, color: color, annotation: annotation),
    );
  }
}

class _StructIconPainter extends CustomPainter {
  _StructIconPainter({required this.kind, required this.color, required this.annotation});

  final StructIconKind kind;
  final Color color;
  final StructIconAnnotation annotation;

  static const _designSize = 18.0;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / _designSize;
    canvas.save();
    canvas.scale(scale);

    final fronts = <Rect>[];
    void box(Rect front, double depth) {
      fronts.add(front);
      _isoBox(canvas, front, depth);
    }

    switch (kind) {
      case StructIconKind.column:
        {
          box(const Rect.fromLTWH(4, 8, 7, 7), 2.4);
          break;
        }
      case StructIconKind.beam:
        {
          box(const Rect.fromLTWH(2, 9.5, 12, 3.6), 2.2);
          break;
        }
      case StructIconKind.wall:
        {
          box(const Rect.fromLTWH(6, 4, 5, 11), 2.2);
          break;
        }
      case StructIconKind.slab:
        {
          box(const Rect.fromLTWH(2, 11.5, 12, 2.6), 2);
          break;
        }
      case StructIconKind.balcony:
        {
          box(const Rect.fromLTWH(2, 3, 3, 12), 1.8);
          box(const Rect.fromLTWH(5, 10.5, 10, 2.6), 1.8);
          canvas.drawLine(
            const Offset(5, 7),
            const Offset(15, 7),
            Paint()
              ..color = color.withValues(alpha: 0.55)
              ..strokeWidth = 1.1,
          );
          break;
        }
      case StructIconKind.beamGrid:
        {
          box(const Rect.fromLTWH(2, 10, 14, 2), 1.8);
          box(const Rect.fromLTWH(8, 3, 2, 9), 1.8);
          break;
        }
      case StructIconKind.building:
        {
          for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) {
              box(Rect.fromLTWH(2.5 + c * 4.5, 3 + r * 4.5, 3, 3), 1.1);
            }
          }
          break;
        }
      case StructIconKind.stairs:
        {
          // 4 ascending iso boxes, same run each, increasing rise — an
          // isometric "escalier" instead of the flat Material glyph.
          box(const Rect.fromLTWH(2, 12, 3.2, 3), 1.6);
          box(const Rect.fromLTWH(5.2, 9, 3.2, 6), 1.6);
          box(const Rect.fromLTWH(8.4, 6, 3.2, 9), 1.6);
          box(const Rect.fromLTWH(11.6, 3, 3.2, 12), 1.6);
          break;
        }
      case StructIconKind.beamUdl:
        {
          // Calculateur de poutres: a simply-supported beam (triangle pin
          // at one end, triangle-on-rollers at the other) under a uniformly
          // distributed load — the textbook "poutre sur 2 appuis" sketch.
          box(const Rect.fromLTWH(2, 8, 14, 2.6), 1.6);
          _drawSupportTriangle(canvas, const Offset(3.6, 10.6), rollers: false);
          _drawSupportTriangle(canvas, const Offset(15.4, 10.6), rollers: true);
          _drawDistributedLoad(canvas, const Rect.fromLTWH(2, 8, 14, 2.6));
          break;
        }
      case StructIconKind.portalFrame:
        {
          // Calculateur de cadres: a single-bay portal frame — 2 poteaux
          // and a poutre closing the rectangle, "structure coordonnée
          // formée de 4 cadres" (4 members meeting at 2 rigid joints).
          box(const Rect.fromLTWH(2.5, 6, 2.6, 9), 1.4);
          box(const Rect.fromLTWH(12.9, 6, 2.6, 9), 1.4);
          box(const Rect.fromLTWH(2.5, 3, 13, 3), 1.4);
          break;
        }
      case StructIconKind.retainingWall:
        {
          // A cantilevered mur de soutènement: a tall vertical stem on a
          // wider horizontal base slab, retained earth suggested by a
          // stepped line on the back (right) side.
          box(const Rect.fromLTWH(6.5, 8.5, 8, 3), 1.6);
          box(const Rect.fromLTWH(4, 2, 3.6, 9), 1.6);
          break;
        }
      case StructIconKind.footing:
        {
          // Semelle de fondation: a shallow wide base slab under a short
          // poteau stub, isolée-style (works for filante too at a glance).
          box(const Rect.fromLTWH(2, 11, 14, 2.6), 1.8);
          box(const Rect.fromLTWH(6.5, 5, 5, 6.5), 1.8);
          break;
        }
    }

    if (annotation != StructIconAnnotation.none) {
      final bounds = fronts.reduce((a, b) => a.expandToInclude(b));
      switch (annotation) {
        case StructIconAnnotation.dimensions:
          {
            _drawDimensions(canvas, bounds);
            break;
          }
        case StructIconAnnotation.load:
          {
            _drawLoadArrows(canvas, bounds);
            break;
          }
        case StructIconAnnotation.rebar:
          {
            _drawRebarSection(canvas, fronts.first);
            break;
          }
        case StructIconAnnotation.none:
          break;
      }
    }

    canvas.restore();
  }

  /// Draws [front] as an extruded block outline — front, top and side
  /// faces each stroked in [color] with a fully transparent fill, so the
  /// glyph reads as a clean isometric line sketch rather than a solid
  /// shaded volume.
  void _isoBox(Canvas canvas, Rect front, double depth) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1
      ..strokeJoin = StrokeJoin.round;

    final topLeft = Offset(front.left + depth, front.top - depth);
    final topRight = Offset(front.right + depth, front.top - depth);
    final bottomRight = Offset(front.right + depth, front.bottom - depth);

    canvas.drawRect(front, stroke);

    final topPath = Path()
      ..moveTo(front.left, front.top)
      ..lineTo(topLeft.dx, topLeft.dy)
      ..lineTo(topRight.dx, topRight.dy)
      ..lineTo(front.right, front.top)
      ..close();
    canvas.drawPath(topPath, stroke);

    final sidePath = Path()
      ..moveTo(front.right, front.top)
      ..lineTo(topRight.dx, topRight.dy)
      ..lineTo(bottomRight.dx, bottomRight.dy)
      ..lineTo(front.right, front.bottom)
      ..close();
    canvas.drawPath(sidePath, stroke);
  }

  /// A small pin (or, with [rollers], pin-on-rollers) support triangle
  /// under [tip] — the standard statics symbol for a simply-supported
  /// beam's end conditions.
  void _drawSupportTriangle(Canvas canvas, Offset tip, {required bool rollers}) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0
      ..strokeJoin = StrokeJoin.round;
    const halfWidth = 1.3;
    const height = 2.0;
    final path = Path()
      ..moveTo(tip.dx, tip.dy)
      ..lineTo(tip.dx - halfWidth, tip.dy + height)
      ..lineTo(tip.dx + halfWidth, tip.dy + height)
      ..close();
    canvas.drawPath(path, stroke);
    if (rollers) {
      final y = tip.dy + height + 0.9;
      canvas.drawCircle(Offset(tip.dx - 0.7, y), 0.5, stroke);
      canvas.drawCircle(Offset(tip.dx + 0.7, y), 0.5, stroke);
    }
  }

  /// A row of short downward ticks along the top of [front] — the
  /// classic "charge répartie" hatching above a loaded beam.
  void _drawDistributedLoad(Canvas canvas, Rect front) {
    final stroke = Paint()
      ..color = color.withValues(alpha: 0.75)
      ..strokeWidth = 0.8
      ..strokeCap = StrokeCap.round;
    final y = front.top - 2.4;
    canvas.drawLine(Offset(front.left, y), Offset(front.right, y), stroke);
    for (var x = front.left + 0.5; x <= front.right; x += 2.3) {
      canvas.drawLine(Offset(x, y), Offset(x, front.top - 0.3), stroke);
    }
  }

  /// A short cotation around [bounds]: a dimension line under the shape
  /// and one to its left, each with tick marks at both ends — the
  /// engineering-drawing shorthand for "this is being measured/sized".
  void _drawDimensions(Canvas canvas, Rect bounds) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 0.9;

    final y = bounds.bottom + 2;
    canvas.drawLine(Offset(bounds.left, y), Offset(bounds.right, y), paint);
    canvas.drawLine(Offset(bounds.left, y - 1.2), Offset(bounds.left, y + 1.2), paint);
    canvas.drawLine(Offset(bounds.right, y - 1.2), Offset(bounds.right, y + 1.2), paint);

    final x = bounds.left - 2;
    canvas.drawLine(Offset(x, bounds.top), Offset(x, bounds.bottom), paint);
    canvas.drawLine(Offset(x - 1.2, bounds.top), Offset(x + 1.2, bounds.top), paint);
    canvas.drawLine(Offset(x - 1.2, bounds.bottom), Offset(x + 1.2, bounds.bottom), paint);
  }

  /// Two small downward arrows landing on top of [bounds] — "this element
  /// is receiving a load", for a descente de charges entry.
  void _drawLoadArrows(Canvas canvas, Rect bounds) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.1
      ..strokeCap = StrokeCap.round;

    final tipY = bounds.top - 1;
    final startY = bounds.top - 5.5;
    for (final t in const [0.28, 0.72]) {
      final fx = bounds.left + bounds.width * t;
      canvas.drawLine(Offset(fx, startY), Offset(fx, tipY), paint);
      canvas.drawLine(Offset(fx - 1.4, tipY - 1.8), Offset(fx, tipY), paint);
      canvas.drawLine(Offset(fx + 1.4, tipY - 1.8), Offset(fx, tipY), paint);
    }
  }

  /// Small filled rebar dots near the corners of [front] — reads as a cut
  /// section through the element showing its ferraillage, for a
  /// dimensionnement béton armé entry ("you're about to design/verify
  /// this element's reinforcement").
  void _drawRebarSection(Canvas canvas, Rect front) {
    final dot = Paint()..color = color;
    const inset = 1.15;
    final positions = <Offset>[
      Offset(front.left + inset, front.top + inset),
      Offset(front.right - inset, front.top + inset),
      Offset(front.left + inset, front.bottom - inset),
      Offset(front.right - inset, front.bottom - inset),
    ];
    for (final p in positions) {
      canvas.drawCircle(p, 0.6, dot);
    }
  }

  @override
  bool shouldRepaint(covariant _StructIconPainter oldDelegate) =>
      oldDelegate.kind != kind || oldDelegate.color != color || oldDelegate.annotation != annotation;
}
