import "package:flutter/material.dart";

import "../theme/app_colors.dart";

/// Row of mutually-exclusive option chips (règlement EC2/BAEL, type
/// d'appui isostatique/continue/console, …) — a lighter-weight alternative
/// to [PickerField] when there are only 2-3 short options worth showing
/// all at once.
class SegmentedChips<T> extends StatelessWidget {
  const SegmentedChips({
    super.key,
    required this.label,
    required this.options,
    required this.optionLabel,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final List<T> options;
  final String Function(T) optionLabel;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final o in options)
              _Chip(
                label: optionLabel(o),
                selected: o == value,
                onTap: () => onChanged(o),
              ),
          ],
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.accentBlue.withValues(alpha: 0.14) : Colors.transparent,
      borderRadius: BorderRadius.circular(9),
      child: InkWell(
        borderRadius: BorderRadius.circular(9),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(9),
            border: Border.all(color: selected ? AppColors.accentBlue : AppColors.border),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? AppColors.accentBlue : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}
