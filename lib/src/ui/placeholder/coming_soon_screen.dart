import "package:flutter/material.dart";

import "../../theme/app_colors.dart";

/// Placeholder destination for flows not yet built in this phase of the
/// port (prédimensionnement, poteau/voile isolés, réseau de poutres,
/// bâtiment complet — see phases 2-6). Never claims to compute anything.
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.construction_outlined,
                size: 34,
                color: AppColors.textTertiary,
              ),
              const SizedBox(height: 16),
              const Text(
                "Bientôt disponible",
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 8),
                Text(
                  subtitle!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
