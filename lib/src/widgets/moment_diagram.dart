import "package:flutter/material.dart";

import "../theme/app_colors.dart";

/// Simple filled-parabola sketch of an isostatic single-span UDL bending
/// moment diagram: M(x) = q×x×(L−x)/2, peaking at mid-span.
class MomentDiagram extends StatelessWidget {
  const MomentDiagram({super.key, required this.lengthM, required this.momentAt, this.height = 90});

  final double lengthM;
  final double Function(double xM) momentAt;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: height,
      child: CustomPaint(
        painter: _MomentDiagramPainter(lengthM: lengthM, momentAt: momentAt),
      ),
    );
  }
}

class _MomentDiagramPainter extends CustomPainter {
  _MomentDiagramPainter({required this.lengthM, required this.momentAt});

  final double lengthM;
  final double Function(double xM) momentAt;

  static const _samples = 24;

  @override
  void paint(Canvas canvas, Size size) {
    if (lengthM <= 0) return;

    final axisY = size.height * 0.12;
    final maxM = List.generate(_samples + 1, (i) => momentAt(lengthM * i / _samples))
        .fold<double>(0, (a, b) => b.abs() > a ? b.abs() : a);
    if (maxM <= 0) return;

    final path = Path()..moveTo(0, axisY);
    for (var i = 0; i <= _samples; i++) {
      final x = size.width * i / _samples;
      final m = momentAt(lengthM * i / _samples);
      final y = axisY + (m / maxM) * (size.height - axisY - 6);
      path.lineTo(x, y);
    }
    path.lineTo(size.width, axisY);
    path.close();

    canvas.drawPath(
      path,
      Paint()..color = AppColors.accentAmber.withValues(alpha: 0.22),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.accentAmber
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6,
    );
    canvas.drawLine(
      Offset(0, axisY),
      Offset(size.width, axisY),
      Paint()
        ..color = AppColors.border
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(covariant _MomentDiagramPainter oldDelegate) => true;
}
