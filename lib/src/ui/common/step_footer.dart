import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../widgets/primary_cta.dart";

/// Bottom nav bar shared by every multi-step flow (spec §2): "Précédent"
/// from step 2 onward, "Suivant →" / "Terminer ✓" on the last step —
/// always visible, including on the results screen.
class StepFooter extends StatelessWidget {
  const StepFooter({
    super.key,
    required this.showPrevious,
    required this.onPrevious,
    required this.nextLabel,
    required this.onNext,
  });

  final bool showPrevious;
  final VoidCallback onPrevious;
  final String nextLabel;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.of(context).padding.bottom),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          if (showPrevious) ...[
            OutlinedButton(
              onPressed: onPrevious,
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.arrow_back, size: 16),
                  SizedBox(width: 6),
                  Text("Précédent"),
                ],
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(child: PrimaryCta(label: nextLabel, onPressed: onNext)),
        ],
      ),
    );
  }
}
