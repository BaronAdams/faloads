import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../widgets/primary_cta.dart";

/// Bottom nav bar shared by every multi-step flow (spec §2): "Précédent"
/// from step 2 onward, "Suivant →" / "Terminer ✓" on the last step —
/// always visible, including on the results screen.
///
/// Debounces the next/finish button for 350ms: a fast double-tap on the
/// HTML prototype could fire two step-advances at once and skip a step —
/// this reproduces the fix rather than the bug.
class StepFooter extends StatefulWidget {
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
  State<StepFooter> createState() => _StepFooterState();
}

class _StepFooterState extends State<StepFooter> {
  DateTime? _lastNextTap;

  void _handleNext() {
    final now = DateTime.now();
    if (_lastNextTap != null && now.difference(_lastNextTap!) < const Duration(milliseconds: 350)) {
      return;
    }
    _lastNextTap = now;
    widget.onNext();
  }

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
          if (widget.showPrevious) ...[
            OutlinedButton(
              onPressed: widget.onPrevious,
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
          Expanded(child: PrimaryCta(label: widget.nextLabel, onPressed: _handleNext)),
        ],
      ),
    );
  }
}
