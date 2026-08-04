import 'package:flutter/material.dart';

class TazaScanLogo extends StatelessWidget {
  const TazaScanLogo({super.key, this.size = 112});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'TazaScan logo',
      image: true,
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(painter: _TazaScanLogoPainter()),
      ),
    );
  }
}

class _TazaScanLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final radius = size.width * 0.22;
    final background = RRect.fromRectAndRadius(rect, Radius.circular(radius));

    canvas.drawRRect(
      background,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF061A47), Color(0xFF02102F)],
        ).createShader(rect),
    );

    _drawScanCorners(canvas, size);
    _drawLeaves(canvas, size);
  }

  void _drawScanCorners(Canvas canvas, Size size) {
    final stroke = size.width * 0.055;
    final inset = size.width * 0.18;
    final length = size.width * 0.16;
    final bend = size.width * 0.06;
    final paint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFF16E5E0), Color(0xFF178AF8)],
      ).createShader(Offset.zero & size)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawPath(
      Path()
        ..moveTo(inset, inset + length)
        ..lineTo(inset, inset + bend)
        ..quadraticBezierTo(inset, inset, inset + bend, inset)
        ..lineTo(inset + length, inset),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(size.width - inset - length, inset)
        ..lineTo(size.width - inset - bend, inset)
        ..quadraticBezierTo(
          size.width - inset,
          inset,
          size.width - inset,
          inset + bend,
        )
        ..lineTo(size.width - inset, inset + length),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(inset, size.height - inset - length)
        ..lineTo(inset, size.height - inset - bend)
        ..quadraticBezierTo(
          inset,
          size.height - inset,
          inset + bend,
          size.height - inset,
        )
        ..lineTo(inset + length, size.height - inset),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(size.width - inset - length, size.height - inset)
        ..lineTo(size.width - inset - bend, size.height - inset)
        ..quadraticBezierTo(
          size.width - inset,
          size.height - inset,
          size.width - inset,
          size.height - inset - bend,
        )
        ..lineTo(size.width - inset, size.height - inset - length),
      paint,
    );
  }

  void _drawLeaves(Canvas canvas, Size size) {
    final stemPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFF1FE4D2), Color(0xFF1689F9)],
      ).createShader(Offset.zero & size)
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.026
      ..strokeCap = StrokeCap.round;

    final leftPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF2FF0C7), Color(0xFF12BFAE)],
      ).createShader(Offset.zero & size);

    final rightPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF1CE3E3), Color(0xFF1677F2)],
      ).createShader(Offset.zero & size);

    final center = Offset(size.width * 0.5, size.height * 0.78);
    final leftLeaf = Path()
      ..moveTo(center.dx - size.width * 0.03, center.dy)
      ..cubicTo(
        size.width * 0.24,
        size.height * 0.61,
        size.width * 0.22,
        size.height * 0.42,
        size.width * 0.28,
        size.height * 0.3,
      )
      ..cubicTo(
        size.width * 0.44,
        size.height * 0.35,
        size.width * 0.58,
        size.height * 0.47,
        size.width * 0.56,
        size.height * 0.57,
      )
      ..cubicTo(
        size.width * 0.53,
        size.height * 0.67,
        size.width * 0.43,
        size.height * 0.7,
        center.dx - size.width * 0.03,
        center.dy,
      )
      ..close();

    final rightLeaf = Path()
      ..moveTo(center.dx + size.width * 0.02, center.dy)
      ..cubicTo(
        size.width * 0.54,
        size.height * 0.52,
        size.width * 0.69,
        size.height * 0.36,
        size.width * 0.82,
        size.height * 0.29,
      )
      ..cubicTo(
        size.width * 0.86,
        size.height * 0.5,
        size.width * 0.73,
        size.height * 0.68,
        size.width * 0.57,
        size.height * 0.74,
      )
      ..cubicTo(
        size.width * 0.54,
        size.height * 0.75,
        size.width * 0.51,
        size.height * 0.76,
        center.dx + size.width * 0.02,
        center.dy,
      )
      ..close();

    canvas.drawPath(leftLeaf, leftPaint);
    canvas.drawPath(rightLeaf, rightPaint);

    canvas.drawPath(
      Path()
        ..moveTo(center.dx, center.dy)
        ..cubicTo(
          size.width * 0.5,
          size.height * 0.56,
          size.width * 0.6,
          size.height * 0.44,
          size.width * 0.8,
          size.height * 0.31,
        ),
      stemPaint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(center.dx - size.width * 0.03, center.dy)
        ..cubicTo(
          size.width * 0.44,
          size.height * 0.62,
          size.width * 0.39,
          size.height * 0.56,
          size.width * 0.34,
          size.height * 0.51,
        ),
      stemPaint,
    );

    final ornamentPaint = Paint()
      ..color = const Color(0xFF031A48)
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.024
      ..strokeCap = StrokeCap.round;

    for (final offset in [0.0, 0.08, 0.16]) {
      final cx = size.width * (0.6 + offset);
      final cy = size.height * (0.62 - offset * 0.65);
      canvas.drawArc(
        Rect.fromCenter(
          center: Offset(cx, cy),
          width: size.width * 0.13,
          height: size.height * 0.13,
        ),
        0.5,
        4.7,
        false,
        ornamentPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
