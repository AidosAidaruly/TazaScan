import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:project/src/core/localization/taza_localizations.dart';

const _capsuleHeight = 70.0;
const _lensRestingDiameter = 80.0;
const _stageHeight = _lensRestingDiameter;

const _tabIcons = <(IconData outline, IconData filled)>[
  (Icons.home_outlined, Icons.home_rounded),
  (Icons.qr_code_scanner_outlined, Icons.qr_code_scanner_rounded),
  (Icons.favorite_border_rounded, Icons.favorite_rounded),
  (Icons.person_outline_rounded, Icons.person_rounded),
];

const _positionSpring = SpringDescription(mass: 1, stiffness: 280, damping: 24);
const _pressSpring = SpringDescription(mass: 1, stiffness: 420, damping: 18);

/// A key for each tab's tap target, stable for widget tests
/// (there are no visible labels to find text by any more).
Key tazaBottomNavItemKey(int index) => ValueKey('taza-bottom-nav-item-$index');

/// Apple "Liquid Glass"-inspired floating tab bar: a genuinely translucent,
/// strongly blurred capsule with icon-only tabs. A single liquid-glass lens
/// travels between tab positions on a spring, stretching horizontally while
/// in motion and settling back to a compact circle, with its own press
/// response. Same public API and index-based navigation as before.
class TazaBottomNavigation extends StatefulWidget {
  const TazaBottomNavigation({
    required this.selectedIndex,
    required this.onDestinationSelected,
    super.key,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;

  @override
  State<TazaBottomNavigation> createState() => _TazaBottomNavigationState();
}

class _TazaBottomNavigationState extends State<TazaBottomNavigation>
    with TickerProviderStateMixin {
  late final AnimationController _position = AnimationController(
    vsync: this,
    lowerBound: 0,
    upperBound: 3,
    value: widget.selectedIndex.toDouble(),
  );
  late final AnimationController _press = AnimationController(vsync: this);

  @override
  void didUpdateWidget(covariant TazaBottomNavigation oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedIndex != widget.selectedIndex) {
      _springTo(_position, _positionSpring, widget.selectedIndex.toDouble());
    }
  }

  @override
  void dispose() {
    _position.dispose();
    _press.dispose();
    super.dispose();
  }

  void _springTo(
    AnimationController controller,
    SpringDescription spring,
    double target,
  ) {
    controller.animateWith(
      SpringSimulation(spring, controller.value, target, controller.velocity),
    );
  }

  void _handlePressStart() => _springTo(_press, _pressSpring, 1);

  void _handlePressEnd() => _springTo(_press, _pressSpring, 0);

  void _handleTap(int index) {
    _handlePressEnd();
    widget.onDestinationSelected(index);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final labels = [t.home, t.scan, t.favorites, t.profile];

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 430),
            child: FractionallySizedBox(
              widthFactor: 0.90,
              child: SizedBox(
                height: _stageHeight,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    _GlassCapsule(
                      child: Row(
                        children: [
                          for (var index = 0; index < 4; index++)
                            Expanded(
                              child: _TapTarget(
                                itemKey: tazaBottomNavItemKey(index),
                                label: labels[index],
                                isSelected: index == widget.selectedIndex,
                                onTapDown: _handlePressStart,
                                onTapCancel: _handlePressEnd,
                                onTap: () => _handleTap(index),
                                child: index == widget.selectedIndex
                                    ? const SizedBox.shrink()
                                    : Icon(
                                        _tabIcons[index].$1,
                                        color: Colors.white.withValues(
                                          alpha: 0.55,
                                        ),
                                        size: 24,
                                      ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    AnimatedBuilder(
                      animation: Listenable.merge([_position, _press]),
                      builder: (context, _) {
                        final p = _position.value;
                        // Center-x of continuous position `p` (0..3) across
                        // 4 equal segments, in Alignment's -1..1 space.
                        final alignX = (2 * p - 3) / 4;

                        final speed = _position.velocity.abs();
                        final moveStretch = (speed * 0.06).clamp(0.0, 0.35);
                        final pressT = _press.value;

                        final scaleX = 1 + moveStretch + 0.10 * pressT;
                        final scaleY =
                            1 - moveStretch * 0.4 - 0.10 * pressT;

                        return Align(
                          alignment: Alignment(alignX, 0),
                          child: IgnorePointer(
                            child: Transform.scale(
                              scaleX: scaleX,
                              scaleY: scaleY,
                              child: _LiquidLens(
                                icon: _tabIcons[widget.selectedIndex].$2,
                                glow: pressT,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The floating glass capsule everything sits on: genuinely translucent, so
/// blurred content behind it stays recognizable, with a soft inner glow, a
/// thin white edge highlight and a very soft shadow.
class _GlassCapsule extends StatelessWidget {
  const _GlassCapsule({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final radius = BorderRadius.circular(_capsuleHeight / 2);

    return Center(
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.14),
              blurRadius: 26,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: radius,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
            child: Container(
              height: _capsuleHeight,
              decoration: BoxDecoration(
                borderRadius: radius,
                color: Colors.white.withValues(alpha: 0.12),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.30),
                  width: 1,
                ),
              ),
              child: Stack(
                children: [
                  // Soft inner glow: a faint brand-tinted wash from the
                  // center, never a fill.
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: radius,
                        gradient: RadialGradient(
                          radius: 1.1,
                          colors: [
                            colorScheme.primary.withValues(alpha: 0.06),
                            Colors.white.withValues(alpha: 0.02),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Crisp specular rim line along the top edge.
                  Positioned(
                    top: 1.4,
                    left: _capsuleHeight * 0.6,
                    right: _capsuleHeight * 0.6,
                    child: Container(
                      height: 1,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(1),
                        color: Colors.white.withValues(alpha: 0.38),
                      ),
                    ),
                  ),
                  child,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TapTarget extends StatelessWidget {
  const _TapTarget({
    required this.itemKey,
    required this.label,
    required this.isSelected,
    required this.onTapDown,
    required this.onTapCancel,
    required this.onTap,
    required this.child,
  });

  final Key itemKey;
  final String label;
  final bool isSelected;
  final VoidCallback onTapDown;
  final VoidCallback onTapCancel;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: isSelected,
      label: label,
      child: Material(
        key: itemKey,
        color: Colors.transparent,
        child: InkWell(
          onTapDown: (_) => onTapDown(),
          onTapCancel: onTapCancel,
          onTap: onTap,
          splashColor: Colors.white.withValues(alpha: 0.10),
          highlightColor: Colors.white.withValues(alpha: 0.05),
          child: SizedBox(
            height: _capsuleHeight,
            child: Center(child: child),
          ),
        ),
      ),
    );
  }
}

/// The single moving liquid-glass lens: a small, brighter, more strongly
/// blurred glass bubble that merges into the capsule beneath it rather than
/// reading as a separate button. `glow` (0..1, driven by press state)
/// brightens its highlight/border/blur to simulate increased refraction.
class _LiquidLens extends StatelessWidget {
  const _LiquidLens({required this.icon, required this.glow});

  final IconData icon;
  final double glow;

  @override
  Widget build(BuildContext context) {
    final brandTint = Theme.of(context).colorScheme.primary;
    final blurSigma = lerpDouble(32, 40, glow)!;
    final fillAlpha = lerpDouble(0.20, 0.30, glow)!;
    final tintAlpha = lerpDouble(0.05, 0.10, glow)!;
    final borderAlpha = lerpDouble(0.45, 0.75, glow)!;
    final borderWidth = lerpDouble(1.2, 1.6, glow)!;
    final highlightAlpha = lerpDouble(0.5, 0.85, glow)!;
    final shadowAlpha = lerpDouble(0.16, 0.24, glow)!;
    final shadowBlur = lerpDouble(20, 26, glow)!;
    final shadowOffsetY = lerpDouble(8, 11, glow)!;

    return SizedBox(
      width: _lensRestingDiameter,
      height: _lensRestingDiameter,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: shadowAlpha),
              blurRadius: shadowBlur,
              offset: Offset(0, shadowOffsetY),
            ),
          ],
        ),
        child: ClipOval(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: fillAlpha),
                border: Border.all(
                  color: Colors.white.withValues(alpha: borderAlpha),
                  width: borderWidth,
                ),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Very faint brand-green wash — a nod to TazaScan, never a
                  // filled green background.
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          radius: 0.9,
                          colors: [
                            brandTint.withValues(alpha: tintAlpha),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Convex specular highlight, as if light is catching the
                  // top-left of the glass lens.
                  Align(
                    alignment: const Alignment(-0.5, -0.62),
                    child: Container(
                      width: _lensRestingDiameter * 0.52,
                      height: _lensRestingDiameter * 0.34,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            Colors.white.withValues(alpha: highlightAlpha),
                            Colors.white.withValues(alpha: 0),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Icon(
                    icon,
                    color: Colors.white,
                    size: _lensRestingDiameter * 0.38,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
