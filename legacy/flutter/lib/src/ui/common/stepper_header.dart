import "package:flutter/material.dart";

import "../../theme/app_colors.dart";

enum _StepState { done, current, upcoming }

/// Numbered-circle stepper shared by every multi-step calculation flow
/// (spec §2): checkmarked once validated, clickable only on steps already
/// reached, horizontally scrollable so it never overflows on a narrow
/// phone (a real bug hit while iterating on the HTML prototype).
class StepperHeader extends StatelessWidget {
  const StepperHeader({
    super.key,
    required this.labels,
    required this.currentStep,
    required this.maxReachedStep,
    required this.onStepTapped,
  });

  final List<String> labels;
  final int currentStep;
  final int maxReachedStep;
  final ValueChanged<int> onStepTapped;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            for (var i = 0; i < labels.length; i++) ...[
              _StepCircle(
                index: i,
                label: labels[i],
                state: i < currentStep
                    ? _StepState.done
                    : i == currentStep
                        ? _StepState.current
                        : _StepState.upcoming,
                enabled: i <= maxReachedStep,
                onTap: () => onStepTapped(i),
              ),
              if (i != labels.length - 1)
                Container(
                  width: 28,
                  height: 1.5,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  color: i < currentStep ? AppColors.accentBlue : AppColors.border,
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StepCircle extends StatelessWidget {
  const _StepCircle({
    required this.index,
    required this.label,
    required this.state,
    required this.enabled,
    required this.onTap,
  });

  final int index;
  final String label;
  final _StepState state;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDone = state == _StepState.done;
    final isCurrent = state == _StepState.current;

    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Column(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDone ? AppColors.accentBlue : AppColors.surfaceRaised,
              border: Border.all(
                color: state == _StepState.upcoming ? AppColors.border : AppColors.accentBlue,
                width: isCurrent ? 2 : 1,
              ),
            ),
            child: Center(
              child: isDone
                  ? const Icon(Icons.check, size: 15, color: Colors.white)
                  : Text(
                      "${index + 1}",
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: isCurrent ? AppColors.accentBlue : AppColors.textTertiary,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            width: 66,
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                color: state == _StepState.upcoming ? AppColors.textTertiary : AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
