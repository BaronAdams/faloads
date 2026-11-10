import "package:flutter/material.dart";

import "../theme/app_colors.dart";

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
  footing
}

/// Annotations select the drawing, rather than decorating a shared box: the
/// loaded column is a 2D elevation and the reinforced column is a cutaway.
enum StructIconAnnotation { none, dimensions, load, rebar }

/// Vector versions of the selected project icons (see docs/project-icons.md).
/// Calculators and the loaded column stay in 2D. Longitudinal steel follows
/// each member's axis and emerges from its ends or is exposed by a cutaway.
class StructIcon extends StatelessWidget {
  const StructIcon({
    super.key,
    required this.kind,
    this.size = 22,
    this.color = AppColors.accentBlue,
    this.detailColor = AppColors.accentOrange,
    this.annotation = StructIconAnnotation.none,
  });

  final StructIconKind kind;
  final double size;
  final Color color;
  final Color detailColor;
  final StructIconAnnotation annotation;

  @override
  Widget build(BuildContext context) => CustomPaint(
        size: Size.square(size),
        painter: _StructIconPainter(
          kind: kind,
          color: color,
          detailColor: detailColor,
          surface: Theme.of(context).colorScheme.surface,
          annotation: annotation,
        ),
      );
}

class _StructIconPainter extends CustomPainter {
  _StructIconPainter(
      {required this.kind,
      required this.color,
      required this.detailColor,
      required this.surface,
      required this.annotation});

  final StructIconKind kind;
  final Color color;
  final Color detailColor;
  final Color surface;
  final StructIconAnnotation annotation;
  bool get _rebar => annotation == StructIconAnnotation.rebar;
  bool get _load => annotation == StructIconAnnotation.load;

  Paint _stroke(Color ink, [double width = 1.25]) => Paint()
    ..color = ink
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeJoin = StrokeJoin.round
    ..strokeCap = StrokeCap.round;

  Path _polygon(List<Offset> points) {
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    return path..close();
  }

  void _face(Canvas canvas, Path path, {double shade = 0.24}) {
    // Opaque, theme-aware faces occlude hidden steel; only exposed ends remain.
    canvas.drawPath(path, Paint()..color = Color.alphaBlend(color.withValues(alpha: shade), surface));
    canvas.drawPath(path, _stroke(color));
  }

  void _poly(Canvas canvas, List<Offset> points, {double shade = 0.24}) =>
      _face(canvas, _polygon(points), shade: shade);
  void _rect(Canvas canvas, Rect rect, {double shade = 0.24}) => _face(canvas, Path()..addRect(rect), shade: shade);
  void _line(Canvas canvas, Offset from, Offset to, {Color? ink, double width = 1.25}) =>
      canvas.drawLine(from, to, _stroke(ink ?? color, width));
  void _rod(Canvas canvas, Offset from, Offset to, {double width = 1.2}) =>
      _line(canvas, from, to, ink: detailColor, width: width);

  void _arrow(Canvas canvas, Offset from, Offset tip) {
    final direction = (tip - from) / (tip - from).distance;
    final normal = Offset(-direction.dy, direction.dx);
    final base = tip - direction * 3;
    _rod(canvas, from, base);
    canvas.drawPath(_polygon([tip, base + normal * 1.65, base - normal * 1.65]), Paint()..color = detailColor);
  }

  void _hatch(Canvas canvas, Path section) {
    final bounds = section.getBounds();
    canvas.save();
    canvas.clipPath(section);
    for (double x = bounds.left - bounds.height; x < bounds.right; x += 3.5) {
      _line(canvas, Offset(x, bounds.bottom), Offset(x + bounds.height, bounds.top),
          ink: color.withValues(alpha: 0.55), width: 0.55);
    }
    canvas.restore();
  }

  void _prism(Canvas canvas, Rect front, Offset depth) {
    _poly(canvas, [front.topLeft, front.topLeft + depth, front.topRight + depth, front.topRight], shade: 0.42);
    _poly(canvas, [front.topRight, front.topRight + depth, front.bottomRight + depth, front.bottomRight], shade: 0.16);
    _rect(canvas, front, shade: 0.30);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final side = size.shortestSide;
    canvas.save();
    canvas.translate((size.width - side) / 2, (size.height - side) / 2);
    canvas.scale(side / 40);
    switch (kind) {
      case StructIconKind.beamUdl:
        _beamCalculator(canvas);
        break; // 01C
      case StructIconKind.portalFrame:
        _frameCalculator(canvas);
        break; // 02B
      case StructIconKind.column:
        if (_load) {
          _loadedColumn(canvas);
        } // 03C
        else if (_rebar) {
          _columnCutaway(canvas);
        } // 06C
        else {
          _prism(canvas, const Rect.fromLTWH(13, 9, 11, 25), const Offset(4, -4));
        }
        break;
      case StructIconKind.wall:
        _wall(canvas);
        break; // 04B / 08C
      case StructIconKind.building:
        _building(canvas);
        break; // 05B
      case StructIconKind.beam:
        _beam(canvas);
        break; // 07B
      case StructIconKind.stairs:
        _stairs(canvas);
        break; // 09A
      case StructIconKind.balcony:
        _balcony(canvas);
        break; // 10C
      case StructIconKind.slab:
        _slab(canvas);
        break; // 11C
      case StructIconKind.retainingWall:
        _retainingWall(canvas);
        break; // 12B
      case StructIconKind.footing:
        _footing(canvas);
        break; // 13C
      case StructIconKind.beamGrid:
        _prism(canvas, const Rect.fromLTWH(4, 23, 30, 5), const Offset(3, -3));
        _prism(canvas, const Rect.fromLTWH(16, 8, 5, 20), const Offset(3, -3));
        if (_rebar) {
          _rod(canvas, const Offset(2, 25), const Offset(38, 25));
          _rod(canvas, const Offset(18, 4), const Offset(18, 32));
        }
        break;
    }
    // These drawings already contain context-specific loads. In particular,
    // calculator screens must not receive a second generic set of arrows.
    if (_load &&
        !const {
          StructIconKind.beamUdl,
          StructIconKind.portalFrame,
          StructIconKind.column,
          StructIconKind.wall,
          StructIconKind.building
        }.contains(kind)) {
      _arrow(canvas, const Offset(14, 2), const Offset(14, 8));
      _arrow(canvas, const Offset(26, 2), const Offset(26, 8));
    }
    if (annotation == StructIconAnnotation.dimensions) _dimensions(canvas);
    canvas.restore();
  }

  void _ground(Canvas canvas, double x, double y) {
    _line(canvas, Offset(x - 3.5, y), Offset(x + 3.5, y));
    for (final dx in [-2.0, 0.0, 2.0]) {
      _line(canvas, Offset(x + dx, y), Offset(x + dx - 1.5, y + 2), width: 0.85);
    }
  }

  // 01C: 2D beam, distributed load, pin/roller supports and bending-curve cue.
  void _beamCalculator(Canvas canvas) {
    _rect(canvas, const Rect.fromLTWH(4, 12, 32, 3), shade: 0.08);
    canvas.drawPath(_polygon(const [Offset(6, 15), Offset(3, 20), Offset(9, 20)]), _stroke(color));
    canvas.drawCircle(const Offset(34, 18), 2, _stroke(color));
    _ground(canvas, 6, 22);
    _ground(canvas, 34, 22);
    _rod(canvas, const Offset(4, 4), const Offset(36, 4));
    for (double x = 5; x <= 35; x += 6) {
      _arrow(canvas, Offset(x, 4), Offset(x, 10.5));
    }
    canvas.drawPath(
        Path()
          ..moveTo(11, 26)
          ..quadraticBezierTo(20, 32, 29, 26),
        _stroke(detailColor));
  }

  // 02B: solid 2D portal with a horizontal force and fixed supports.
  void _frameCalculator(Canvas canvas) {
    _poly(
        canvas,
        const [
          Offset(9, 10),
          Offset(34, 10),
          Offset(34, 32),
          Offset(29, 32),
          Offset(29, 15),
          Offset(14, 15),
          Offset(14, 32),
          Offset(9, 32)
        ],
        shade: 0.88);
    _arrow(canvas, const Offset(2, 12), const Offset(9, 12));
    _ground(canvas, 11.5, 33);
    _ground(canvas, 31.5, 33);
  }

  // 03C: successive floor loads pass down one column, in front elevation.
  void _loadedColumn(Canvas canvas) {
    _rect(canvas, const Rect.fromLTWH(18, 10, 4, 22), shade: 0.08);
    _rect(canvas, const Rect.fromLTWH(6, 8, 28, 2.5), shade: 0.10);
    _rect(canvas, const Rect.fromLTWH(6, 20, 28, 2.5), shade: 0.10);
    _rect(canvas, const Rect.fromLTWH(12, 33, 16, 2.5), shade: 0.10);
    _arrow(canvas, const Offset(20, 1), const Offset(20, 7));
    _arrow(canvas, const Offset(20, 12), const Offset(20, 18));
    _arrow(canvas, const Offset(20, 24), const Offset(20, 31));
  }

  // 06C: four upright long bars, two closed stirrups and lower concrete shell.
  void _columnCutaway(Canvas canvas) {
    _line(canvas, const Offset(12, 11), const Offset(12, 32));
    _line(canvas, const Offset(28, 11), const Offset(28, 32));
    for (final (x, top, bottom) in [(14.0, 3.0, 35.0), (18.0, 1.5, 38.0), (22.0, 5.0, 37.0), (26.0, 3.0, 35.0)]) {
      _rod(canvas, Offset(x, top), Offset(x, bottom));
    }
    for (final y in [11.0, 18.0]) {
      canvas.drawPath(
          _polygon([Offset(13, y), Offset(20, y - 3), Offset(27, y), Offset(20, y + 3)]), _stroke(detailColor, 0.85));
    }
    _poly(canvas,
        const [Offset(12, 22), Offset(16, 24), Offset(18, 23.5), Offset(20, 26), Offset(20, 36), Offset(12, 32)],
        shade: 0.34);
    _poly(
        canvas, const [Offset(20, 26), Offset(23, 23), Offset(25, 24), Offset(28, 22), Offset(28, 32), Offset(20, 36)],
        shade: 0.18);
  }

  // 04B / 08C: the same coherent thin-panel projection, solid or cut away.
  void _wall(Canvas canvas) {
    _poly(canvas, const [Offset(4, 12), Offset(31, 6), Offset(33, 7.5), Offset(6, 13.5)], shade: 0.42);
    _poly(canvas, const [Offset(4, 12), Offset(6, 13.5), Offset(6, 36), Offset(4, 34.5)], shade: 0.18);
    final outline = _polygon(const [Offset(6, 13.5), Offset(33, 7.5), Offset(33, 30), Offset(6, 36)]);
    if (_rebar) {
      canvas.drawPath(outline, _stroke(color));
      for (final x in [11.0, 20.0, 29.0]) {
        _rod(canvas, Offset(x, 2), Offset(x, 38));
      }
      _rod(canvas, const Offset(9, 17), const Offset(31, 12.1), width: 0.9);
      _rod(canvas, const Offset(9, 24), const Offset(31, 19.1), width: 0.9);
      _face(
          canvas,
          Path()
            ..moveTo(6, 13.5)
            ..cubicTo(11, 12, 9, 20, 15, 23)
            ..cubicTo(21, 28, 27, 27, 33, 23)
            ..lineTo(33, 30)
            ..lineTo(6, 36)
            ..close(),
          shade: 0.30);
    } else {
      _face(canvas, outline, shade: 0.30);
    }
    if (_load) {
      _arrow(canvas, const Offset(11, 4), const Offset(11, 11));
      _arrow(canvas, const Offset(21, 2), const Offset(21, 8.5));
      _arrow(canvas, const Offset(30, 1), const Offset(30, 6.5));
    }
  }

  // 05B: connected columns and plates, rather than separate cubes.
  void _building(Canvas canvas) {
    for (final (x, y) in [(16.0, 6.0), (35.0, 10.0)]) {
      _line(canvas, Offset(x, y), Offset(x, y + 20), width: 1.7);
    }
    for (final dy in [10.0, 0.0]) {
      _poly(canvas, [Offset(7, 12 + dy), Offset(16, 6 + dy), Offset(35, 10 + dy), Offset(26, 16 + dy)], shade: 0.32);
    }
    for (final (x, y) in [(7.0, 12.0), (26.0, 16.0)]) {
      _line(canvas, Offset(x, y), Offset(x, y + 20), width: 1.7);
    }
    for (final p in const [Offset(7, 32), Offset(26, 36), Offset(16, 26), Offset(35, 30)]) {
      _prism(canvas, Rect.fromCenter(center: p, width: 5, height: 2.5), const Offset(1.5, -1));
    }
    if (_load) {
      _arrow(canvas, const Offset(21, 1), const Offset(21, 10));
      _arrow(canvas, const Offset(21, 17), const Offset(21, 24));
      _arrow(canvas, const Offset(21, 28), const Offset(21, 35));
    }
  }

  // 07B: long rods emerge from both ends, parallel to the beam's axis.
  void _beam(Canvas canvas) {
    if (_rebar) {
      for (final y in [20.0, 24.0, 28.0]) {
        _rod(canvas, Offset(2, y), Offset(38, y - 8.64));
      }
    }
    _poly(canvas, const [Offset(6, 18), Offset(10, 14), Offset(35, 8), Offset(31, 12)], shade: 0.42);
    _poly(canvas, const [Offset(31, 12), Offset(35, 8), Offset(35, 20), Offset(31, 24)], shade: 0.18);
    _poly(canvas, const [Offset(6, 18), Offset(31, 12), Offset(31, 24), Offset(6, 30)], shade: 0.30);
  }

  // 09A: a side elevation; steel runs continuously along the inclined waist.
  void _stairs(Canvas canvas) {
    _poly(
        canvas,
        const [
          Offset(5, 29),
          Offset(5, 23),
          Offset(11, 23),
          Offset(11, 18),
          Offset(17, 18),
          Offset(17, 13),
          Offset(23, 13),
          Offset(23, 8),
          Offset(31, 8),
          Offset(31, 17),
          Offset(10, 36),
          Offset(5, 36)
        ],
        shade: 0.30);
    if (_rebar) {
      for (final dy in [0.0, 3.0]) {
        canvas.drawPath(
            Path()
              ..moveTo(2, 32 + dy)
              ..lineTo(7, 32 + dy)
              ..lineTo(32, 11 + dy)
              ..lineTo(37, 10 + dy),
            _stroke(detailColor, 1.2));
      }
    }
  }

  // 10C: 2D cut through a cantilever, with top steel anchored at the wall.
  void _balcony(Canvas canvas) {
    _poly(
        canvas,
        const [
          Offset(6, 5),
          Offset(11, 5),
          Offset(11, 16),
          Offset(36, 16),
          Offset(36, 23),
          Offset(11, 23),
          Offset(11, 35),
          Offset(6, 35)
        ],
        shade: 0.30);
    if (_rebar) {
      _hatch(canvas, Path()..addRect(const Rect.fromLTWH(11, 16, 25, 7)));
      canvas.drawPath(
          Path()
            ..moveTo(35, 18)
            ..lineTo(12, 18)
            ..quadraticBezierTo(8, 18, 8, 22)
            ..lineTo(35, 22),
          _stroke(detailColor, 1.2));
    }
  }

  // 11C: one affine plane defines both concrete and exposed reinforcement.
  void _slab(Canvas canvas) {
    Offset p(double u, double v, [double z = 0]) => Offset(4 + 25 * u + 9 * v, 25 + 3 * u - 17 * v + z);
    final a = p(0, 0), b = p(1, 0), c = p(1, 1), d = p(0, 1);
    const depth = Offset(0, 4);
    if (!_rebar) {
      _poly(canvas, [a, b, b + depth, a + depth], shade: 0.18);
      _poly(canvas, [b, c, c + depth, b + depth], shade: 0.22);
      _poly(canvas, [a, b, c, d], shade: 0.36);
      return;
    }
    canvas.drawPath(_polygon([a, b, c, d]), _stroke(color));
    _line(canvas, a + depth, b + depth);
    _line(canvas, b + depth, c + depth);
    final cut = [p(0.5, 0), p(0.55, 0.35), p(0.6, 0.6), p(1, 0.6)];
    final section = _polygon([...cut, ...cut.reversed.map((point) => point + depth)]);
    _face(canvas, section, shade: 0.18);
    _hatch(canvas, section);
    for (final v in [0.12, 0.3, 0.48]) {
      _rod(canvas, p(0.5, v, 2), p(1.13, v, 2));
    }
    for (final u in [0.72, 0.92]) {
      _rod(canvas, p(u, -0.07, 2), p(u, 0.63, 2), width: 0.9);
    }
    _poly(canvas, [a, cut.first, cut.first + depth, a + depth], shade: 0.22);
    _poly(canvas, [c, cut.last, cut.last + depth, c + depth], shade: 0.18);
    _poly(canvas, [a, d, c, ...cut.reversed], shade: 0.36);
  }

  // 12B: extruded L-shaped concrete with continuous bent longitudinal bars.
  void _retainingWall(Canvas canvas) {
    _poly(canvas, const [Offset(7, 8), Offset(12, 4), Offset(17, 4), Offset(12, 8)], shade: 0.42);
    _poly(canvas, const [Offset(12, 8), Offset(17, 4), Offset(17, 22), Offset(12, 26)], shade: 0.18);
    _poly(canvas, const [Offset(12, 26), Offset(17, 22), Offset(37, 22), Offset(32, 26)], shade: 0.42);
    _poly(canvas, const [Offset(32, 26), Offset(37, 22), Offset(37, 28), Offset(32, 32)], shade: 0.18);
    _poly(canvas, const [Offset(7, 8), Offset(12, 8), Offset(12, 26), Offset(32, 26), Offset(32, 32), Offset(7, 32)],
        shade: 0.30);
    if (_rebar) {
      for (final shift in [Offset.zero, const Offset(2, -2)]) {
        canvas.save();
        canvas.translate(shift.dx, shift.dy);
        canvas.drawPath(
            Path()
              ..moveTo(9, 3)
              ..lineTo(9, 26)
              ..quadraticBezierTo(9, 29, 12, 29)
              ..lineTo(36, 29),
            _stroke(detailColor, 1.2));
        canvas.restore();
      }
    }
  }

  // 13C: an open corner exposes bottom mesh, separate from the starter bars.
  void _footing(Canvas canvas) {
    Offset p(double u, double v, [double z = 0]) => Offset(3 + 26 * u + 9 * v, 24 + 5 * u - 11 * v + z);
    final a = p(0, 0), b = p(1, 0), c = p(1, 1), d = p(0, 1);
    const depth = Offset(0, 8);
    if (_rebar) {
      final cut = [p(0.5, 0), p(0.58, 0.5), p(1, 0.5)];
      _line(canvas, a + depth, b + depth);
      _line(canvas, b + depth, c + depth);
      final section = _polygon([...cut, ...cut.reversed.map((point) => point + depth)]);
      _face(canvas, section, shade: 0.18);
      _hatch(canvas, section);
      for (final v in [0.05, 0.25, 0.45]) {
        _rod(canvas, p(0.48, v, 6), p(1.08, v, 6));
      }
      for (final u in [0.65, 0.85]) {
        _rod(canvas, p(u, -0.05, 6), p(u, 0.6, 6), width: 0.9);
      }
      _poly(canvas, [a, cut.first, cut.first + depth, a + depth], shade: 0.26);
      _poly(canvas, [c, cut.last, cut.last + depth, c + depth], shade: 0.18);
      _poly(canvas, [a, d, c, ...cut.reversed], shade: 0.36);
    } else {
      _poly(canvas, [a, b, b + depth, a + depth], shade: 0.26);
      _poly(canvas, [b, c, c + depth, b + depth], shade: 0.18);
      _poly(canvas, [a, b, c, d], shade: 0.36);
    }
    _prism(canvas, const Rect.fromLTWH(15, 11, 9, 11), const Offset(3, -3));
    if (_rebar) {
      for (final (x, top, bottom) in [(17.0, 4.0, 10.0), (20.0, 2.0, 9.0), (23.0, 4.0, 10.0), (26.0, 2.0, 8.0)]) {
        _rod(canvas, Offset(x, top), Offset(x, bottom));
      }
    }
  }

  void _dimensions(Canvas canvas) {
    _line(canvas, const Offset(6, 38), const Offset(33, 38), width: 0.7);
    _line(canvas, const Offset(2, 8), const Offset(2, 34), width: 0.7);
    for (final x in [6.0, 33.0]) {
      _line(canvas, Offset(x, 36.5), Offset(x, 39.5), width: 0.7);
    }
    for (final y in [8.0, 34.0]) {
      _line(canvas, Offset(0.5, y), Offset(3.5, y), width: 0.7);
    }
  }

  @override
  bool shouldRepaint(covariant _StructIconPainter oldDelegate) =>
      oldDelegate.kind != kind ||
      oldDelegate.color != color ||
      oldDelegate.detailColor != detailColor ||
      oldDelegate.surface != surface ||
      oldDelegate.annotation != annotation;
}
