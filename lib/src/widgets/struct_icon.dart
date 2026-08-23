import "package:flutter/material.dart";

import "../theme/app_colors.dart";

/// The structural element (or assembly) a [StructIcon] depicts.
enum StructIconKind { column, beam, wall, slab, balcony, stairs, beamGrid, building }

/// Small 2.5D (isometric-shaded) glyph for a structural element — a block
/// for a poteau, an elongated bar for a poutre, a tall slab for a voile,
/// and so on — instead of a generic Material icon that doesn't actually
/// say "column" or "wall". Ported from the design prototype's icon set
/// (renderIcon: 'column', 'beam', 'wall', 'building'), extended with
/// matching glyphs for the element types the prototype didn't need an
/// icon for, and given a light/base/dark 3-face shading so each glyph
/// reads as a small extruded block rather than a flat shape.
class StructIcon extends StatelessWidget {
  const StructIcon({super.key, required this.kind, this.size = 22, this.color = AppColors.accentBlue});

  final StructIconKind kind;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (kind == StructIconKind.stairs) {
      return Icon(Icons.stairs_outlined, size: size, color: color);
    }
    return CustomPaint(size: Size.square(size), painter: _StructIconPainter(kind: kind, color: color));
  }
}

class _StructIconPainter extends CustomPainter {
  _StructIconPainter({required this.kind, required this.color});

  final StructIconKind kind;
  final Color color;

  static const _designSize = 18.0;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / _designSize;
    canvas.save();
    canvas.scale(scale);

    switch (kind) {
      case StructIconKind.column:
        {
          _isoBox(canvas, const Rect.fromLTWH(4, 8, 7, 7), 2.4, color);
          break;
        }
      case StructIconKind.beam:
        {
          _isoBox(canvas, const Rect.fromLTWH(2, 9.5, 12, 3.6), 2.2, color);
          break;
        }
      case StructIconKind.wall:
        {
          _isoBox(canvas, const Rect.fromLTWH(6, 4, 5, 11), 2.2, color);
          break;
        }
      case StructIconKind.slab:
        {
          _isoBox(canvas, const Rect.fromLTWH(2, 11.5, 12, 2.6), 2, color);
          break;
        }
      case StructIconKind.balcony:
        {
          _isoBox(canvas, const Rect.fromLTWH(2, 3, 3, 12), 1.8, color);
          _isoBox(canvas, const Rect.fromLTWH(5, 10.5, 10, 2.6), 1.8, color);
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
          _isoBox(canvas, const Rect.fromLTWH(2, 10, 14, 2), 1.8, color);
          _isoBox(canvas, const Rect.fromLTWH(8, 3, 2, 9), 1.8, color);
          break;
        }
      case StructIconKind.building:
        {
          for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) {
              _isoBox(canvas, Rect.fromLTWH(2.5 + c * 4.5, 3 + r * 4.5, 3, 3), 1.1, color);
            }
          }
          break;
        }
      case StructIconKind.stairs:
        break; // handled by StructIcon.build via Icons.stairs_outlined
    }

    canvas.restore();
  }

  /// Draws [front] as a small extruded block: a lighter top face and a
  /// darker side face (offset up-right by [depth]) around the base-colour
  /// front face — the classic 3-face isometric shading that makes a flat
  /// rectangle read as a 2.5D block.
  void _isoBox(Canvas canvas, Rect front, double depth, Color base) {
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

  @override
  bool shouldRepaint(covariant _StructIconPainter oldDelegate) => oldDelegate.kind != kind || oldDelegate.color != color;
}
