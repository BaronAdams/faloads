import "package:flutter/material.dart";

/// Bottom-anchored full-width call to action, used throughout onboarding,
/// the paywall, and every step footer — kept thumb-reachable per the spec's
/// mobile guidance. Scales down slightly on press for tactile feedback.
class PrimaryCta extends StatefulWidget {
  const PrimaryCta({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  State<PrimaryCta> createState() => _PrimaryCtaState();
}

class _PrimaryCtaState extends State<PrimaryCta> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (widget.onPressed == null) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      // A Listener (not a GestureDetector) so this purely observes pointer
      // events for the press-scale feel without joining the gesture arena —
      // the ElevatedButton underneath keeps handling the actual tap/splash.
      onPointerDown: (_) => _setPressed(true),
      onPointerUp: (_) => _setPressed(false),
      onPointerCancel: (_) => _setPressed(false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: widget.onPressed,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(widget.label),
                if (widget.icon != null) ...[
                  const SizedBox(width: 8),
                  Icon(widget.icon, size: 18),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
