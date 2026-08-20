import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_theme.dart";

class PredimResultData {
  const PredimResultData({required this.big, required this.sub, required this.formula});

  final String big;
  final String sub;
  final String formula;
}

/// The "section recommandée" card shown by the standalone prédimensionnement
/// screen and, reusing the same formulas, at the end of the poteau/voile
/// isolé load-descent flows (spec §3-5).
class PredimResultPanel extends StatelessWidget {
  const PredimResultPanel({super.key, required this.result, this.title = "SECTION RECOMMANDÉE"});

  final PredimResultData result;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceRaised,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.accentBlue),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: AppColors.accentBlue,
            ),
          ),
          const SizedBox(height: 8),
          Text(result.big, style: AppTheme.monoTextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(result.sub, style: AppTheme.monoTextStyle(fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(height: 10),
          Text(
            result.formula,
            style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }
}
