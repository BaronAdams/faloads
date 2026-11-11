import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_theme.dart";

/// One label/value line in a results card — shared by the beam and frame
/// calculators. [highlight] recolors the value (e.g. red/green for a
/// pass/fail check) instead of the default text color.
class ResultRow extends StatelessWidget {
  const ResultRow({super.key, required this.label, required this.value, this.highlight});

  final String label;
  final String value;
  final Color? highlight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(child: Text(label, style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary))),
          Text(
            value,
            style: AppTheme.monoTextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: highlight ?? AppColors.textPrimary),
          ),
        ],
      ),
    );
  }
}
