import 'package:flutter/material.dart';
import 'package:project/src/core/theme/app_colors.dart';

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
    final radius = size.width * 0.28;
    final background = RRect.fromRectAndRadius(rect, Radius.circular(radius));

    canvas.drawRRect(background, Paint()..color = AppColors.primaryGreen);

    _drawLeaf(canvas, size);
  }

  void _drawLeaf(Canvas canvas, Size size) {
    final leafPaint = Paint()..color = Colors.white;
    final center = Offset(size.width * 0.5, size.height * 0.5);

    final leaf = Path()
      ..moveTo(center.dx, size.height * 0.24)
      ..cubicTo(
        size.width * 0.76,
        size.height * 0.28,
        size.width * 0.78,
        size.height * 0.56,
        size.width * 0.62,
        size.height * 0.7,
      )
      ..cubicTo(
        size.width * 0.5,
        size.height * 0.8,
        size.width * 0.32,
        size.height * 0.78,
        center.dx,
        size.height * 0.24,
      )
      ..close();

    canvas.drawPath(leaf, leafPaint);

    final veinPaint = Paint()
      ..color = AppColors.primaryGreen
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.028
      ..strokeCap = StrokeCap.round;

    canvas.drawPath(
      Path()
        ..moveTo(center.dx, size.height * 0.3)
        ..quadraticBezierTo(
          size.width * 0.58,
          size.height * 0.5,
          size.width * 0.44,
          size.height * 0.72,
        ),
      veinPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
