import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "../theme/app_colors.dart";
import "../theme/app_theme.dart";

/// Labeled numeric input with an optional unit suffix, styled with the
/// monospace type the spec reserves for numeric/technical values.
///
/// Owns its own [TextEditingController] seeded from [value] once, so typing
/// doesn't get interrupted by the parent rebuilding with the freshly-typed
/// value (a controlled `initialValue` re-keyed on every change would lose
/// focus/cursor on each keystroke). Pass a stable [key] identifying *which*
/// field this is (e.g. per level, per element type) — changing that key is
/// what should reset the controller, not the value changing.
class NumberField extends StatefulWidget {
  const NumberField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.unit,
    this.min = 0,
  });

  final String label;
  final double value;
  final ValueChanged<double> onChanged;
  final String? unit;
  final double min;

  @override
  State<NumberField> createState() => _NumberFieldState();
}

class _NumberFieldState extends State<NumberField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: _formatInitial(widget.value));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  static String _formatInitial(double v) {
    return v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        TextFormField(
          controller: _controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r"[0-9.]"))],
          style: AppTheme.monoTextStyle(fontSize: 14.5),
          decoration: InputDecoration(
            isDense: true,
            suffixText: widget.unit,
            suffixStyle: const TextStyle(fontSize: 12, color: AppColors.textTertiary),
          ),
          onChanged: (raw) {
            final parsed = double.tryParse(raw);
            if (parsed != null) widget.onChanged(parsed < widget.min ? widget.min : parsed);
          },
        ),
      ],
    );
  }
}
