import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';
import 'calculator_model.dart';

const calculatorOrange = Color(0xFFF2A052);
const calculatorViolet = Color(0xFFB487F5);
const calculatorTeal = Color(0xFF3FAE9C);

class CalculatorPanel extends StatelessWidget {
  const CalculatorPanel({super.key, required this.child, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => Material(
        color: Theme.of(context).colorScheme.surface,
        clipBehavior: Clip.antiAlias,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: AppColors.border)),
        child: Padding(padding: padding, child: child),
      );
}

class CalculatorNumberField extends StatelessWidget {
  const CalculatorNumberField(
      {super.key,
      required this.label,
      required this.value,
      required this.onChanged,
      this.unit,
      this.minimum = 0,
      this.maximum,
      this.decimals = 2});
  final String label;
  final double value;
  final ValueChanged<double> onChanged;
  final String? unit;
  final double minimum;
  final double? maximum;
  final int decimals;
  double? _parse(String? text) => double.tryParse((text ?? '').replaceAll(' ', '').replaceAll(',', '.'));
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        TextFormField(
          key: ValueKey('calculator-input-$label'),
          initialValue: calcNumber(value, decimals),
          keyboardType: TextInputType.numberWithOptions(decimal: true, signed: minimum < 0),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,\-]'))],
          style: AppTheme.monoTextStyle(fontSize: 14),
          textInputAction: TextInputAction.next,
          decoration: InputDecoration(
              isDense: true,
              suffixText: unit,
              errorMaxLines: 3,
              suffixStyle: const TextStyle(fontFamily: AppTheme.uiFontFamily, fontSize: 12)),
          validator: (raw) {
            final number = _parse(raw);
            if (number == null || !number.isFinite) return 'Saisissez un nombre.';
            if (number < minimum) return 'Minimum : ${calcNumber(minimum)}.';
            if (maximum != null && number > maximum!) return 'Maximum : ${calcNumber(maximum!)}.';
            return null;
          },
          onChanged: (raw) {
            final number = _parse(raw);
            if (number != null && number.isFinite && number >= minimum && (maximum == null || number <= maximum!)) {
              onChanged(number);
            }
          },
        ),
      ]);
}

class CalculatorChoice extends StatelessWidget {
  const CalculatorChoice(
      {super.key,
      required this.label,
      required this.value,
      required this.options,
      required this.onChanged,
      this.numeric = false});
  final String label, value;
  final List<String> options;
  final ValueChanged<String> onChanged;
  final bool numeric;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          key: ValueKey('calculator-choice-$label-$value'),
          initialValue: value,
          isExpanded: true,
          style: numeric ? AppTheme.monoTextStyle(fontSize: 14) : Theme.of(context).textTheme.bodyMedium,
          decoration: const InputDecoration(isDense: true),
          items: options
              .map((option) => DropdownMenuItem(value: option, child: Text(option, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: (value) {
            if (value != null) onChanged(value);
          },
        ),
      ]);
}

class CalculatorPair extends StatelessWidget {
  const CalculatorPair({super.key, required this.first, required this.second});
  final Widget first, second;
  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, constraints) {
        if (constraints.maxWidth < 240) {
          return Column(children: [first, const SizedBox(height: 12), second]);
        }
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: first),
          const SizedBox(width: 12),
          Expanded(child: second),
        ]);
      });
}

class CalculatorHeading extends StatelessWidget {
  const CalculatorHeading(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(children: [
          Expanded(child: Text(text, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700))),
          if (trailing != null) trailing!
        ]),
      );
}

class CalculatorNotice extends StatelessWidget {
  const CalculatorNotice(this.text, {super.key, this.color = AppColors.accentBlue});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: .3))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.info_outline, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(fontSize: 12, color: AppColors.textSecondary)))
        ]),
      );
}

class CalculatorMetric extends StatelessWidget {
  const CalculatorMetric(
      {super.key, required this.label, required this.value, this.unit = '', this.color, this.numeric = true});
  final String label, value, unit;
  final Color? color;
  final bool numeric;
  @override
  Widget build(BuildContext context) => CalculatorPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        const SizedBox(height: 8),
        Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 6, children: [
          Text(value,
              style: numeric
                  ? AppTheme.monoTextStyle(fontSize: 21, fontWeight: FontWeight.w700, color: color)
                  : TextStyle(
                      fontFamily: AppTheme.uiFontFamily, fontSize: 21, fontWeight: FontWeight.w700, color: color)),
          if (unit.isNotEmpty) Text(unit, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        ]),
      ]));
}

class CalculatorDirectionField extends StatefulWidget {
  const CalculatorDirectionField(
      {super.key,
      required this.label,
      required this.value,
      required this.unit,
      required this.positive,
      required this.negative,
      required this.onChanged});
  final String label, unit, positive, negative;
  final double value;
  final ValueChanged<double> onChanged;
  @override
  State<CalculatorDirectionField> createState() => _CalculatorDirectionFieldState();
}

class _CalculatorDirectionFieldState extends State<CalculatorDirectionField> {
  late double magnitude = widget.value.abs();
  late bool positive = widget.value >= 0;
  void _update() => widget.onChanged(magnitude * (positive ? 1 : -1));
  @override
  Widget build(BuildContext context) => CalculatorPair(
        first: CalculatorNumberField(
            label: widget.label,
            value: magnitude,
            unit: widget.unit,
            onChanged: (value) {
              magnitude = value;
              _update();
            }),
        second: CalculatorChoice(
            label: 'Sens',
            value: positive ? widget.positive : widget.negative,
            options: [widget.positive, widget.negative],
            onChanged: (value) {
              setState(() => positive = value == widget.positive);
              _update();
            }),
      );
}
