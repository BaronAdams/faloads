import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';
import 'calculator_model.dart';
import 'calculator_reference_data.dart';
import 'calculator_widgets.dart';

class CalculatorSceneGeometry {
  CalculatorSceneGeometry(this.model, this.size) {
    if (model.kind == CalculatorKind.beam) {
      scale = math.max(1, size.width - 96) / model.length;
      origin = Offset(48, size.height * .5);
    } else if (model.nodes.isNotEmpty) {
      minX = model.nodes.map((n) => n.number('x')).reduce(math.min);
      final maxX = model.nodes.map((n) => n.number('x')).reduce(math.max);
      minY = model.nodes.map((n) => n.number('y')).reduce(math.min);
      final maxY = model.nodes.map((n) => n.number('y')).reduce(math.max);
      final width = math.max(1.0, maxX - minX), height = math.max(1.0, maxY - minY);
      scale = math.min(math.max(1, size.width - 120) / width, math.max(1, size.height - 150) / height);
      origin = Offset(
          (size.width - width * scale) / 2 - minX * scale, (size.height + height * scale) / 2 + minY * scale + 10);
    }
  }
  final CalculatorModel model;
  final Size size;
  double scale = 1, minX = 0, minY = 0;
  Offset origin = Offset.zero;
  Offset point(double x, double y) => Offset(origin.dx + x * scale, origin.dy - y * scale);
  Offset node(CalculatorItem item) => point(item.number('x'), item.number('y'));
  double _distance(Offset p, Offset a, Offset b) {
    final d = b - a;
    if (d.distanceSquared == 0) return (p - a).distance;
    final t = (((p - a).dx * d.dx + (p - a).dy * d.dy) / d.distanceSquared).clamp(0.0, 1.0);
    return (p - a - d * t).distance;
  }

  CalculatorSelection? hit(Offset position) {
    if (model.kind == CalculatorKind.frame) {
      for (final n in model.nodes.reversed) {
        if ((position - node(n)).distance < 22) return (type: CalculatorObject.node, id: n.id);
      }
      for (final member in model.members.reversed) {
        final a = model.nodes.firstWhere((n) => n.id == member.text('a'));
        final b = model.nodes.firstWhere((n) => n.id == member.text('b'));
        if (_distance(position, node(a), node(b)) < 16) return (type: CalculatorObject.member, id: member.id);
      }
    } else {
      for (final load in model.loads.reversed) {
        if (load.text('type') == 'distributed') {
          if (Rect.fromLTRB(point(load.number('start'), 0).dx - 10, origin.dy - 66,
                  point(load.number('end'), 0).dx + 10, origin.dy + 5)
              .contains(position)) {
            return (type: CalculatorObject.load, id: load.id);
          }
        } else {
          if (Rect.fromCenter(center: point(load.number('x'), 0) + const Offset(0, -44), width: 38, height: 100)
              .contains(position)) {
            return (type: CalculatorObject.load, id: load.id);
          }
        }
      }
      for (final support in model.supports) {
        if (Rect.fromCenter(center: point(support.number('x'), 0) + const Offset(0, 20), width: 40, height: 48)
            .contains(position)) {
          return (type: CalculatorObject.support, id: support.id);
        }
      }
      for (final hinge in model.hinges) {
        if ((position - point(hinge.number('x'), 0)).distance < 18) return (type: CalculatorObject.hinge, id: hinge.id);
      }
      for (final section in model.sections) {
        if (_distance(position, point(section.number('start'), 0), point(section.number('end'), 0)) < 12) {
          return (type: CalculatorObject.section, id: section.id);
        }
      }
    }
    return null;
  }
}

class CalculatorPlayground extends StatefulWidget {
  const CalculatorPlayground(
      {super.key,
      required this.model,
      required this.selection,
      required this.onSelect,
      required this.onAdd,
      this.view = CalculatorView.structure,
      this.amplification = 100});
  final CalculatorModel model;
  final CalculatorSelection? selection;
  final ValueChanged<CalculatorSelection> onSelect;
  final VoidCallback onAdd;
  final CalculatorView view;
  final double amplification;
  @override
  State<CalculatorPlayground> createState() => CalculatorPlaygroundState();
}

class CalculatorPlaygroundState extends State<CalculatorPlayground> {
  final TransformationController _camera = TransformationController();
  final FocusNode _focus = FocusNode(debugLabel: 'Calculator playground');
  bool _hand = false, _space = false;
  Size _viewport = Size.zero;
  double get zoom => _camera.value.getMaxScaleOnAxis();
  @override
  void initState() {
    super.initState();
    _camera.addListener(_cameraChanged);
  }

  void _cameraChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _camera.removeListener(_cameraChanged);
    _camera.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _zoom(double factor) {
    final next = (zoom * factor).clamp(.5, 6.0);
    final center = Offset(_viewport.width / 2, _viewport.height / 2);
    final ratio = next / zoom;
    final delta = Matrix4.diagonal3Values(ratio, ratio, 1)
      ..setTranslationRaw(center.dx * (1 - ratio), center.dy * (1 - ratio), 0);
    _camera.value = delta * _camera.value;
  }

  @override
  Widget build(BuildContext context) => CalculatorPanel(
      padding: const EdgeInsets.all(12),
      child: Column(children: [
        const CalculatorHeading('Schéma interactif'),
        Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
          ChoiceChip(
              label: const Text('Sélection'),
              showCheckmark: false,
              labelStyle: const TextStyle(fontFamily: AppTheme.uiFontFamily, fontSize: 12),
              selectedColor: AppColors.accentBlue.withValues(alpha: .25),
              avatar: const Icon(Icons.near_me_outlined, size: 16),
              selected: !_hand,
              onSelected: (_) => setState(() => _hand = false)),
          ChoiceChip(
              label: Text(MediaQuery.sizeOf(context).width < 1000 ? 'Vue' : 'Déplacer la vue'),
              tooltip: 'Déplacer la vue',
              showCheckmark: false,
              labelStyle: const TextStyle(fontFamily: AppTheme.uiFontFamily, fontSize: 12),
              selectedColor: AppColors.accentBlue.withValues(alpha: .25),
              avatar: const Icon(Icons.pan_tool_outlined, size: 16),
              selected: _hand,
              onSelected: (_) => setState(() => _hand = true)),
          OutlinedButton.icon(
              onPressed: widget.onAdd, icon: const Icon(Icons.add, size: 18), label: const Text('Ajouter')),
        ]),
        const SizedBox(height: 10),
        LayoutBuilder(builder: (context, constraints) {
          final height =
              constraints.maxWidth >= 600 ? (widget.model.kind == CalculatorKind.beam ? 250.0 : 340.0) : 260.0;
          _viewport = Size(constraints.maxWidth, height);
          final geometry = CalculatorSceneGeometry(widget.model, _viewport);
          return Focus(
            focusNode: _focus,
            onKeyEvent: (node, event) {
              if (event.logicalKey == LogicalKeyboardKey.space) {
                setState(() => _space = event is! KeyUpEvent);
                return KeyEventResult.handled;
              }
              return KeyEventResult.ignored;
            },
            onFocusChange: (focused) {
              if (!focused && _space) setState(() => _space = false);
            },
            child: MouseRegion(
              cursor: _hand || _space ? SystemMouseCursors.grab : SystemMouseCursors.precise,
              child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(
                    height: height,
                    child: Listener(
                        onPointerDown: (_) => _focus.requestFocus(),
                        child: InteractiveViewer(
                          key: const Key('calculator-interactive-viewer'),
                          transformationController: _camera,
                          minScale: .5,
                          maxScale: 6,
                          boundaryMargin: const EdgeInsets.all(500),
                          trackpadScrollCausesScale: true,
                          child: GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTapUp: (details) {
                                if (_hand || _space) return;
                                final selection = geometry.hit(details.localPosition);
                                if (selection != null) widget.onSelect(selection);
                              },
                              child: CustomPaint(
                                  key: const Key('calculator-scene'),
                                  size: _viewport,
                                  painter: CalculatorScenePainter(
                                      model: widget.model,
                                      selection: widget.selection,
                                      view: widget.view,
                                      amplification: widget.amplification,
                                      foreground: AppColors.textPrimary,
                                      background: AppColors.background,
                                      border: AppColors.border,
                                      uiTextScale: MediaQuery.textScalerOf(context).scale(12) / 12))),
                        )),
                  )),
            ),
          );
        }),
        const SizedBox(height: 8),
        Wrap(
            alignment: WrapAlignment.spaceBetween,
            spacing: 12,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                  MediaQuery.sizeOf(context).width >= 1000
                      ? 'Molette : zoom · Espace + glisser : déplacer'
                      : 'Glisser pour naviguer · Pincer pour zoomer',
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              Wrap(spacing: 2, crossAxisAlignment: WrapCrossAlignment.center, children: [
                IconButton(
                    key: const Key('calculator-zoom-out'),
                    tooltip: 'Dézoomer',
                    onPressed: () => _zoom(1 / 1.25),
                    icon: const Icon(Icons.remove)),
                Text('${(zoom * 100).round()} %', style: AppTheme.monoTextStyle(fontSize: 12)),
                IconButton(
                    key: const Key('calculator-zoom-in'),
                    tooltip: 'Zoomer',
                    onPressed: () => _zoom(1.25),
                    icon: const Icon(Icons.add)),
                TextButton.icon(
                    key: const Key('calculator-recenter'),
                    onPressed: () => _camera.value = Matrix4.identity(),
                    icon: const Icon(Icons.center_focus_strong, size: 18),
                    label: const Text('Recentrer')),
              ]),
            ]),
      ]));
}

class CalculatorScenePainter extends CustomPainter {
  CalculatorScenePainter(
      {required this.model,
      required this.selection,
      required this.view,
      required this.amplification,
      required this.foreground,
      required this.background,
      required this.border,
      this.uiTextScale = 1});
  final CalculatorModel model;
  final CalculatorSelection? selection;
  final CalculatorView view;
  final double amplification, uiTextScale;
  final Color foreground, background, border;
  late Canvas _canvas;
  late CalculatorSceneGeometry _g;
  bool _selected(CalculatorObject type, String id) => selection?.type == type && selection?.id == id;
  Paint _stroke(Color color, [double width = 1.5]) => Paint()
    ..color = color
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;
  void _line(Offset a, Offset b, {Color? color, double width = 1.5}) =>
      _canvas.drawLine(a, b, _stroke(color ?? foreground, width));
  void _text(String text, Offset position,
      {Color? color, bool numeric = false, double size = 12, TextAlign align = TextAlign.center}) {
    final painter = TextPainter(
        text: TextSpan(
            text: text,
            style: TextStyle(
                fontFamily: numeric ? AppTheme.monoFontFamily : AppTheme.uiFontFamily,
                fontSize: size * uiTextScale,
                fontWeight: FontWeight.w500,
                color: color ?? foreground)),
        textDirection: TextDirection.ltr);
    painter.layout();
    final dx = align == TextAlign.left
        ? 0.0
        : align == TextAlign.right
            ? painter.width
            : painter.width / 2;
    painter.paint(_canvas, position - Offset(dx, painter.height / 2));
  }

  void _arrow(Offset a, Offset b, {Color color = calculatorOrange}) {
    if ((b - a).distance < .01) return;
    final dir = (b - a) / (b - a).distance, normal = Offset(-(b - a).dy, (b - a).dx) / (b - a).distance;
    final base = b - dir * 8;
    _line(a, base, color: color, width: 2);
    _canvas.drawPath(
        Path()
          ..moveTo(b.dx, b.dy)
          ..lineTo((base + normal * 4).dx, (base + normal * 4).dy)
          ..lineTo((base - normal * 4).dx, (base - normal * 4).dy)
          ..close(),
        Paint()..color = color);
  }

  void _ground(Offset p) {
    _line(p + const Offset(-14, 0), p + const Offset(14, 0));
    for (double x = -10; x <= 14; x += 6) {
      _line(p + Offset(x, 0), p + Offset(x - 5, 6), width: 1);
    }
  }

  void _support(Offset p, String type) {
    if (type == 'Encastrement') {
      _ground(p + const Offset(0, 6));
      return;
    }
    if (type == 'Aucun') return;
    if (type == 'Appui élastique') {
      final path = Path()..moveTo(p.dx, p.dy + 3);
      for (var i = 0; i < 6; i++) {
        path.lineTo(p.dx + (i.isEven ? -5 : 5), p.dy + 7 + i * 3);
      }
      _canvas.drawPath(path, _stroke(foreground));
      _ground(p + const Offset(0, 28));
      return;
    }
    final path = Path()
      ..moveTo(p.dx, p.dy + 3)
      ..lineTo(p.dx - 9, p.dy + 18)
      ..lineTo(p.dx + 9, p.dy + 18)
      ..close();
    _canvas.drawPath(path, Paint()..color = background);
    _canvas.drawPath(path, _stroke(foreground));
    final roller = type == 'Appui simple' || type == 'Appui vertical';
    if (roller) {
      for (final x in [-4.0, 4.0]) {
        _canvas.drawCircle(p + Offset(x, 22), 2.5, _stroke(foreground));
      }
    }
    _ground(p + Offset(0, roller ? 27 : 19));
  }

  void _distributed(Offset a, Offset b, double start, double end, String label, {bool selected = false}) {
    final maxLoad = math.max(start.abs(), end.abs());
    if (maxLoad == 0) return;
    final path = Path()
      ..moveTo(a.dx, a.dy)
      ..lineTo(a.dx, a.dy - 32 * start.abs() / maxLoad)
      ..lineTo(b.dx, b.dy - 32 * end.abs() / maxLoad)
      ..lineTo(b.dx, b.dy)
      ..close();
    _canvas.drawPath(path, Paint()..color = (selected ? AppColors.accentBlue : calculatorOrange).withValues(alpha: .1));
    _canvas.drawPath(path, _stroke(selected ? AppColors.accentBlue : calculatorOrange));
    final count = math.max(2, ((b - a).distance / 28).round());
    for (var i = 0; i <= count; i++) {
      final t = i / count, magnitude = start + (end - start) * t;
      final p = Offset.lerp(a, b, t)!;
      final top = p + Offset(0, -32 * magnitude.abs() / maxLoad);
      if (magnitude >= 0) {
        _arrow(top, p);
      } else {
        _arrow(p, top);
      }
    }
    _text(label, (a + b) / 2 + const Offset(0, -46), color: calculatorOrange, numeric: true, size: 11);
  }

  void _dimension(Offset a, Offset b, String label, {bool vertical = false}) {
    _line(a, b, color: foreground.withValues(alpha: .65), width: .8);
    final tick = vertical ? const Offset(5, 0) : const Offset(0, 5);
    _line(a - tick, a + tick, width: .8);
    _line(b - tick, b + tick, width: .8);
    _text(label, (a + b) / 2 + (vertical ? const Offset(12, 0) : const Offset(0, 15)),
        numeric: true, size: 11, align: vertical ? TextAlign.left : TextAlign.center);
  }

  @override
  void paint(Canvas canvas, Size size) {
    _canvas = canvas;
    _g = CalculatorSceneGeometry(model, size);
    canvas.drawRect(Offset.zero & size, Paint()..color = background);
    for (double x = 0; x < size.width; x += 24) {
      _line(Offset(x, 0), Offset(x, size.height), color: border.withValues(alpha: .35), width: .5);
    }
    for (double y = 0; y < size.height; y += 24) {
      _line(Offset(0, y), Offset(size.width, y), color: border.withValues(alpha: .35), width: .5);
    }
    if (model.kind == CalculatorKind.beam) {
      _beam();
    } else {
      _frame();
    }
  }

  void _beam() {
    final a = _g.point(0, 0), b = _g.point(model.length, 0);
    for (final section in model.sections) {
      final selected = _selected(CalculatorObject.section, section.id);
      _line(_g.point(section.number('start'), 0), _g.point(section.number('end'), 0),
          color: selected ? AppColors.accentBlue : foreground, width: selected ? 7 : 4);
    }
    for (final load in model.loads) {
      final selected = _selected(CalculatorObject.load, load.id);
      if (load.text('type') == 'distributed') {
        _distributed(
            _g.point(load.number('start'), 0) + const Offset(0, -6),
            _g.point(load.number('end'), 0) + const Offset(0, -6),
            load.number('value'),
            load.number('endValue', load.number('value')),
            '${load.id} · ${calcNumber(load.number('value'), 0)} kN/m',
            selected: selected);
      } else {
        final p = _g.point(load.number('x'), 0);
        if (selected) {
          _canvas.drawCircle(
              p + const Offset(0, -38), 20, Paint()..color = AppColors.accentBlue.withValues(alpha: .12));
        }
        if (load.text('type') == 'moment') {
          _canvas.drawArc(Rect.fromCircle(center: p, radius: 16), -.8, 4.8, false, _stroke(calculatorOrange, 2));
          _arrow(p + const Offset(12, 13), p + const Offset(16, 5));
        } else {
          if (load.number('value') >= 0) {
            _arrow(p + const Offset(0, -80), p + const Offset(0, -7));
          } else {
            _arrow(p + const Offset(0, -7), p + const Offset(0, -80));
          }
          if (load.number('horizontal') != 0) _arrow(p, p + Offset(load.number('horizontal') > 0 ? 35 : -35, 0));
        }
        _text('${load.id} · ${calcNumber(load.number('value'), 0)} ${load.text('type') == 'moment' ? 'kN·m' : 'kN'}',
            p + const Offset(0, -96),
            numeric: true, color: calculatorOrange, size: 11);
      }
    }
    for (final support in model.supports) {
      final p = _g.point(support.number('x'), 0);
      if (_selected(CalculatorObject.support, support.id)) {
        _canvas.drawCircle(p + const Offset(0, 16), 20, Paint()..color = AppColors.accentBlue.withValues(alpha: .16));
      }
      _support(p, support.text('type'));
      _text(support.id, p + const Offset(-14, -15), numeric: true);
      if (model.isReference) {
        _arrow(p + const Offset(0, 68), p + const Offset(0, 34), color: calculatorTeal);
        _text(support.id == 'A' ? '51,00 kN' : '37,00 kN', p + const Offset(0, 84),
            numeric: true, color: calculatorTeal, size: 10);
      }
    }
    for (final h in model.hinges) {
      _canvas.drawCircle(_g.point(h.number('x'), 0), 6, Paint()..color = background);
      _canvas.drawCircle(_g.point(h.number('x'), 0), 6, _stroke(AppColors.accentBlue, 2));
    }
    _dimension(a + const Offset(0, 106), b + const Offset(0, 106), '${calcNumber(model.length)} m');
  }

  void _frame() {
    if (model.nodes.isEmpty) {
      _text('Ajoutez un nœud pour commencer', Offset(_g.size.width / 2, _g.size.height / 2));
      return;
    }
    final reference = model.isReference;
    for (final member in model.members) {
      final na = model.nodes.firstWhere((n) => n.id == member.text('a')),
          nb = model.nodes.firstWhere((n) => n.id == member.text('b'));
      final a = _g.node(na), b = _g.node(nb);
      _line(a, b,
          color:
              _selected(CalculatorObject.member, member.id) ? AppColors.accentBlue : foreground.withValues(alpha: .85),
          width: 4);
      if (view == CalculatorView.structure) {
        if (member.number('w') != 0) {
          _distributed(a + const Offset(0, -8), b + const Offset(0, -8), member.number('w'), member.number('w'),
              'w = ${calcNumber(member.number('w'), 0)} kN/m',
              selected: _selected(CalculatorObject.member, member.id));
        }
        _text(member.id, (a + b) / 2 + (na.number('y') == nb.number('y') ? const Offset(0, 18) : const Offset(-18, 0)),
            color: AppColors.accentBlue, numeric: true, size: 11);
      }
      if (reference && view != CalculatorView.structure) _frameDiagram(member, na, nb, a, b);
    }
    for (final node in model.nodes) {
      final p = _g.node(node);
      _support(p, node.text('support'));
      if (reference && view == CalculatorView.structure && (node.id == 'N1' || node.id == 'N4')) {
        _arrow(p + const Offset(0, 32), p + const Offset(0, 12), color: calculatorTeal);
        _text(node.id == 'N1' ? '55,26 kN' : '64,74 kN', p + Offset(node.id == 'N1' ? 8 : -8, 22),
            color: calculatorTeal, numeric: true, size: 10, align: node.id == 'N1' ? TextAlign.left : TextAlign.right);
      }
      if (view == CalculatorView.structure) {
        if (node.number('fx') != 0) {
          final dir = node.number('fx').sign;
          _arrow(p - Offset(48 * dir, 0), p - Offset(8 * dir, 0));
          _text('${calcNumber(node.number('fx').abs(), 0)} kN', p - Offset(40 * dir, 18),
              color: calculatorOrange, numeric: true, size: 11);
        }
        if (node.number('fy') != 0) {
          _arrow(p + Offset(0, node.number('fy') > 0 ? 42 : -42), p + Offset(0, node.number('fy') > 0 ? 7 : -7));
        }
        if (node.number('moment') != 0) {
          _canvas.drawArc(
              Rect.fromCircle(center: p, radius: 18), 0, math.pi * 1.6, false, _stroke(calculatorOrange, 2));
        }
      }
      _canvas.drawCircle(
          p, 5, Paint()..color = _selected(CalculatorObject.node, node.id) ? AppColors.accentBlue : foreground);
      _text(node.id, p + Offset(14, node.number('y') == _g.minY ? -13 : -17), numeric: true, size: 11);
    }
    final xs = model.nodes.map((n) => n.number('x')), ys = model.nodes.map((n) => n.number('y'));
    final left = xs.reduce(math.min),
        right = xs.reduce(math.max),
        top = ys.reduce(math.max),
        bottom = ys.reduce(math.min);
    _dimension(_g.point(left, bottom) + const Offset(0, 38), _g.point(right, bottom) + const Offset(0, 38),
        '${calcNumber(right - left)} m');
    _dimension(_g.point(right, bottom) + const Offset(24, 0), _g.point(right, top) + const Offset(24, 0),
        '${calcNumber(top - bottom)} m',
        vertical: true);
  }

  void _frameDiagram(CalculatorItem member, CalculatorItem na, CalculatorItem nb, Offset a, Offset b) {
    if (view == CalculatorView.deflection) {
      final curve = Path();
      final points = frameReferenceDeflections[member.id]!;
      for (var i = 0; i < points.length; i++) {
        final point = points[i];
        final p = _g.point(point[0] + point[2] * amplification, point[1] + point[3] * amplification);
        if (i == 0) {
          curve.moveTo(p.dx, p.dy);
        } else {
          curve.lineTo(p.dx, p.dy);
        }
      }
      _canvas.drawPath(curve, _stroke(calculatorTeal, 2.5));
      return;
    }
    final length =
        math.sqrt(math.pow(na.number('x') - nb.number('x'), 2) + math.pow(na.number('y') - nb.number('y'), 2));
    final axis = (b - a) / (b - a).distance;
    final normal = Offset(-axis.dy, axis.dx);
    final curve = Path()..moveTo(a.dx, a.dy);
    for (var i = 0; i <= 40; i++) {
      final t = i / 40, x = t * length;
      final value = switch (view) {
        CalculatorView.moment => CalculatorReference.frameMoment(member.id, x),
        CalculatorView.shear => switch (member.id) {
            'B1' => -1.31796345,
            'B2' => 55.25991468 - 20 * x,
            _ => 16.31796345
          },
        CalculatorView.normal => switch (member.id) { 'B1' => -55.25991468, 'B2' => -16.31796345, _ => -64.74008532 },
        _ => 0.0,
      };
      final p = Offset.lerp(a, b, t)! + normal * value * .65;
      curve.lineTo(p.dx, p.dy);
    }
    curve
      ..lineTo(b.dx, b.dy)
      ..close();
    _canvas.drawPath(curve, Paint()..color = calculatorViolet.withValues(alpha: .15));
    _canvas.drawPath(curve, _stroke(calculatorViolet, 1.6));
  }

  @override
  bool shouldRepaint(covariant CalculatorScenePainter oldDelegate) => true;
}

class CalculatorBeamDiagram extends StatelessWidget {
  const CalculatorBeamDiagram({super.key, required this.view, required this.x, required this.onRead});
  final CalculatorView view;
  final double x;
  final ValueChanged<double> onRead;
  static double value(CalculatorView view, double x) {
    if (view == CalculatorView.moment) return CalculatorReference.beamMoment(x);
    if (view == CalculatorView.shear) return CalculatorReference.beamShear(x);
    if (view == CalculatorView.normal) return 0;
    final index = (x / .2).floor().clamp(0, 39);
    final t = ((x - index * .2) / .2).clamp(0.0, 1.0);
    final column = view == CalculatorView.rotation ? 2 : 1;
    return beamReferenceDeflectionRotation[index][column] * (1 - t) +
        beamReferenceDeflectionRotation[index + 1][column] * t;
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
      builder: (context, constraints) => GestureDetector(
            onTapDown: (event) =>
                onRead(((event.localPosition.dx - 40) / (constraints.maxWidth - 60) * 8).clamp(0.0, 8.0)),
            onHorizontalDragUpdate: (event) =>
                onRead(((event.localPosition.dx - 40) / (constraints.maxWidth - 60) * 8).clamp(0.0, 8.0)),
            child: CustomPaint(
                key: const Key('calculator-beam-diagram'),
                size: Size(constraints.maxWidth, 160),
                painter:
                    _BeamDiagramPainter(view: view, x: x, foreground: AppColors.textPrimary, border: AppColors.border)),
          ));
}

class _BeamDiagramPainter extends CustomPainter {
  _BeamDiagramPainter({required this.view, required this.x, required this.foreground, required this.border});
  final CalculatorView view;
  final double x;
  final Color foreground, border;
  void _label(Canvas canvas, String label, Offset position, {Color? color}) {
    final painter = TextPainter(
        text: TextSpan(text: label, style: AppTheme.monoTextStyle(fontSize: 10, color: color ?? foreground)),
        textDirection: TextDirection.ltr)
      ..layout();
    painter.paint(canvas, position - Offset(painter.width / 2, painter.height / 2));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final values = [for (var i = 0; i <= 160; i++) CalculatorBeamDiagram.value(view, i / 20)];
    final minV = math.min(0.0, values.reduce(math.min)), maxV = math.max(.01, values.reduce(math.max));
    final range = maxV - minV, left = 40.0, right = size.width - 20;
    double px(double x) => left + (right - left) * x / 8;
    double py(double v) => 20 + (v - minV) / range * (size.height - 60);
    for (var i = 0; i <= 4; i++) {
      final v = minV + range * i / 4, y = py(v);
      canvas.drawLine(
          Offset(left, y),
          Offset(right, y),
          Paint()
            ..color = border
            ..strokeWidth = .6);
      _label(canvas, calcNumber(v, 0), Offset(19, y));
    }
    final curve = Path()..moveTo(px(0), py(values.first));
    for (var i = 1; i < values.length; i++) {
      curve.lineTo(px(i / 20), py(values[i]));
    }
    final fill = Path.from(curve)
      ..lineTo(px(8), py(0))
      ..lineTo(px(0), py(0))
      ..close();
    canvas.drawPath(fill, Paint()..color = calculatorViolet.withValues(alpha: .15));
    canvas.drawPath(
        curve,
        Paint()
          ..color = calculatorViolet
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2);
    canvas.drawLine(
        Offset(left, py(0)),
        Offset(right, py(0)),
        Paint()
          ..color = foreground
          ..strokeWidth = 1);
    final cursorY = py(CalculatorBeamDiagram.value(view, x));
    for (double y = 15; y < size.height - 30; y += 9) {
      canvas.drawLine(Offset(px(x), y), Offset(px(x), y + 4), Paint()..color = calculatorViolet.withValues(alpha: .6));
    }
    canvas.drawCircle(Offset(px(x), cursorY), 4, Paint()..color = calculatorViolet);
    for (final mark in [0.0, 4.0, 5.0, 8.0]) {
      _label(canvas, calcNumber(mark, 0), Offset(px(mark), size.height - 12));
    }
  }

  @override
  bool shouldRepaint(covariant _BeamDiagramPainter oldDelegate) =>
      oldDelegate.view != view ||
      oldDelegate.x != x ||
      oldDelegate.foreground != foreground ||
      oldDelegate.border != border;
}
