import "package:flutter/material.dart";

import "../theme/app_colors.dart";

/// Labeled "select" row that opens a bottom sheet list of [options] —
/// the mobile equivalent of a `<select>`, used for béton/règlement/type
/// choices throughout the calculation flows.
class PickerField extends StatelessWidget {
  const PickerField({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.optionLabel,
  });

  final String label;
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;

  /// Optional display label for an option id, e.g. mapping "cc12" → "CC 12+4".
  final String Function(String id)? optionLabel;

  String _labelOf(String id) => optionLabel?.call(id) ?? id;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        Material(
          color: AppColors.surfaceRaised,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: () => _open(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(_labelOf(value), style: const TextStyle(fontSize: 14.5)),
                  ),
                  const Icon(Icons.unfold_more, size: 16, color: AppColors.textTertiary),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _open(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
            for (final o in options)
              ListTile(
                title: Text(_labelOf(o)),
                trailing: o == value ? const Icon(Icons.check, color: AppColors.accentBlue) : null,
                onTap: () {
                  onChanged(o);
                  Navigator.of(context).pop();
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
