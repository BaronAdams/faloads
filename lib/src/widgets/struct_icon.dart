import "package:flutter/material.dart";

import "../theme/app_colors.dart";

/// The structural element (or assembly) a [StructIcon] depicts.
enum StructIconKind { column, beam, wall, slab, balcony, stairs, beamGrid, building }

/// What extra cue to overlay on the glyph: dimension lines (cotes), for a
/// prédimensionnement entry — "you're about to size this" — or downward
/// load arrows, for a descente de charges entry — "this is what receives
/// a load".
enum StructIconAnnotation { none, dimensions, load }

/// Small 2.5D (isometric-shaded) glyph for a structural element — a block
/// for a poteau, an elongated bar for a poutre, a tall slab for a voile,
/// and so on — instead of a generic Material icon that doesn't actually
/// say "column" or "wall". Each block's faces are tinted toward a
/// concrete grey (not a flat saturated colour) so it reads as béton armé,
/// with the category accent still showing through for at-a-glance
/// identification. Ported from the design prototype's icon set
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
    final painter = CustomPaint(
      size: Size.square(size),
      painter: _StructIconPainter(kind: kind, color: color, annotation: annotation),
    );
    if (kind != StructIconKind.stairs) return painter;
    // Stairs stays the built-in Material glyph (already unambiguous) with
    // just the annotation painted over it, instead of a hand-drawn stair.
    return SizedBox.square(
      dimension: size,
      child: Stack(
        alignment: Alignment.center,
        children: [Icon(Icons.stairs_outlined, size: size, color: color), painter],
      ),
    );
  }
}

class _StructIconPainter extends CustomPainter {
  _StructIconPainter({required this.kind, required this.color, required this.annotation});

  final StructIconKind kind;
  final Color color;
  final StructIconAnnotation annotation;

  static const _designSize = 18.0;
  static const _concreteGrey = Color(0xFF9199A6);

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
        break; // handled by StructIcon.build via Icons.stairs_outlined
    }

    if (annotation != StructIconAnnotation.none) {
      final bounds = kind == StructIconKind.stairs
          ? const Rect.fromLTWH(3, 3, 12, 12)
          : fronts.reduce((a, b) => a.expandToInclude(b));
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
        case StructIconAnnotation.none:
          break;
      }
    }

    canvas.restore();
  }

  /// Draws [front] as a small extruded block: a lighter top face and a
  /// darker side face (offset up-right by [depth]) around a base face
  /// blended toward concrete grey — the classic 3-face isometric shading
  /// that makes a flat rectangle read as a 2.5D block of béton.
  void _isoBox(Canvas canvas, Rect front, double depth) {
    final base = Color.lerp(color, _concreteGrey, 0.32)!;
    final top = Color.lerp(base, Colors.white, 0.35)!;
    final side = Color.lerp(base, Colors.black, 0.35)!;

    final sidePath = Path()
      ..moveTo(front.right, front.top)
      ..lineTo(front.right + depth, front.top - depth)
      ..lineTo(front.right + depth, front.bottom - depth)
      ..lineTo(front.right, front.bottom)
      ..close();
    canvas.drawPath(sidePath, Paint()..color = side);

    final topPath = Path()
      ..moveTo(front.left, front.top)
      ..lineTo(front.left + depth, front.top - depth)
      ..lineTo(front.right + depth, front.top - depth)
      ..lineTo(front.right, front.top)
      ..close();
    canvas.drawPath(topPath, Paint()..color = top);

    canvas.drawRect(front, Paint()..color = base);
  }

  /// A short cotation around [bounds]: a dimension line under the shape
  /// and one to its left, each with tick marks at both ends — the
  /// engineering-drawing shorthand for "this is being measured/sized".
  void _drawDimensions(Canvas canvas, Rect bounds) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.85)
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
      ..color = Colors.white.withValues(alpha: 0.85)
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

  @override
  bool shouldRepaint(covariant _StructIconPainter oldDelegate) =>
      oldDelegate.kind != kind || oldDelegate.color != color || oldDelegate.annotation != annotation;
}
