import "package:flutter/material.dart";

import "../theme/app_colors.dart";

/// The structural element (or assembly) a [StructIcon] depicts.
enum StructIconKind { column, beam, wall, slab, balcony, stairs, beamGrid, building }

/// Small abstract glyph for a structural element — a filled square for a
/// poteau, a bar for a poutre, a tall bar for a voile, and so on — instead
/// of a generic Material icon that doesn't actually say "column" or "wall".
/// Ported from the design prototype's icon set (renderIcon: 'column',
/// 'beam', 'wall', 'building'), extended with matching glyphs for the
/// element types the prototype didn't need an icon for.
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
          _rrect(canvas, const Rect.fromLTWH(5, 5, 8, 8), 1.5, color);
          break;
        }
      case StructIconKind.beam:
        {
          _rrect(canvas, const Rect.fromLTWH(2, 6, 14, 3), 1, color);
          _rrect(canvas, const Rect.fromLTWH(2, 10, 14, 1.4), 0.7, color.withValues(alpha: 0.5));
          break;
        }
      case StructIconKind.wall:
        {
          _rrect(canvas, const Rect.fromLTWH(6, 3, 6, 12), 1, color);
          break;
        }
      case StructIconKind.slab:
        {
          _rrect(canvas, const Rect.fromLTWH(2, 2, 14, 14), 2, color.withValues(alpha: 0.16));
          final stroke = Paint()
            ..color = color
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1;
          canvas.drawRect(const Rect.fromLTWH(2, 2, 14, 14), stroke);
          canvas.drawLine(const Offset(9, 2), const Offset(9, 16), stroke);
          canvas.drawLine(const Offset(2, 9), const Offset(16, 9), stroke);
          break;
        }
      case StructIconKind.balcony:
        {
          _rrect(canvas, const Rect.fromLTWH(2, 2, 3, 14), 1, color);
          _rrect(canvas, const Rect.fromLTWH(5, 9.5, 11, 3), 1, color);
          canvas.drawLine(
            const Offset(5, 6),
            const Offset(16, 6),
            Paint()
              ..color = color.withValues(alpha: 0.6)
              ..strokeWidth = 1.2,
          );
          break;
        }
      case StructIconKind.beamGrid:
        {
          final stroke = Paint()
            ..color = color
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.4;
          canvas.drawRect(const Rect.fromLTWH(2, 2, 14, 14), stroke);
          canvas.drawLine(const Offset(9, 2), const Offset(9, 16), stroke);
          canvas.drawLine(const Offset(2, 9), const Offset(16, 9), stroke);
          break;
        }
      case StructIconKind.building:
        {
          for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) {
              _rrect(canvas, Rect.fromLTWH(3 + c * 5, 3 + r * 5, 3.5, 3.5), 0.8, color);
            }
          }
          break;
        }
      case StructIconKind.stairs:
        break; // handled by StructIcon.build via Icons.stairs_outlined
    }

    canvas.restore();
  }

  void _rrect(Canvas canvas, Rect rect, double radius, Color fill) {
    canvas.drawRRect(RRect.fromRectAndRadius(rect, Radius.circular(radius)), Paint()..color = fill);
  }

  @override
  bool shouldRepaint(covariant _StructIconPainter oldDelegate) => oldDelegate.kind != kind || oldDelegate.color != color;
}
