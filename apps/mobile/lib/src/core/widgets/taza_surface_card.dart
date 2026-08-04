import 'package:flutter/material.dart';

class TazaSurfaceCard extends StatefulWidget {
  const TazaSurfaceCard({
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.borderRadius = 24,
    this.onTap,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final VoidCallback? onTap;

  @override
  State<TazaSurfaceCard> createState() => _TazaSurfaceCardState();
}

class _TazaSurfaceCardState extends State<TazaSurfaceCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final radius = BorderRadius.circular(widget.borderRadius);

    return AnimatedScale(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOutCubic,
      scale: _pressed ? 0.985 : 1,
      child: Material(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: radius,
        shadowColor: Colors.black.withValues(alpha: 0.22),
        elevation: 3,
        child: InkWell(
          onTap: widget.onTap,
          onTapDown: widget.onTap == null
              ? null
              : (_) => setState(() => _pressed = true),
          onTapCancel: widget.onTap == null
              ? null
              : () => setState(() => _pressed = false),
          onTapUp: widget.onTap == null
              ? null
              : (_) => setState(() => _pressed = false),
          borderRadius: radius,
          splashColor: colorScheme.primary.withValues(alpha: 0.08),
          highlightColor: Colors.white.withValues(alpha: 0.03),
          child: Padding(padding: widget.padding, child: widget.child),
        ),
      ),
    );
  }
}

class TazaCard extends TazaSurfaceCard {
  const TazaCard({
    required super.child,
    super.padding,
    super.borderRadius,
    super.onTap,
    super.key,
  });
}
