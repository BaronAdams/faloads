import "package:flutter/material.dart";

import "../../state/app_scope.dart";
import "../../theme/app_colors.dart";
import "../../widgets/primary_cta.dart";
import "../shell/app_shell.dart";
import "onboarding_screen.dart";

/// Entry screen: states StructCalc's value proposition across its two
/// calculation modes (isolated element vs. full building) before the user
/// commits to onboarding.
class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.surfaceRaised,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Icon(
                  Icons.architecture_outlined,
                  color: AppColors.accentBlue,
                  size: 30,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                "StructCalc",
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              const Text(
                "Descente de charges et prédimensionnement en béton armé,"
                " sur chantier ou au bureau.",
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14.5,
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 28),
              const _ModeRow(),
              const Spacer(),
              PrimaryCta(
                label: "Commencer",
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const OnboardingScreen()),
                  );
                },
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  final app = AppScope.of(context);
                  app.completeOnboarding();
                  app.logIn();
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const AppShell()),
                    (route) => false,
                  );
                },
                child: const Text("J'ai déjà un compte"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModeRow extends StatelessWidget {
  const _ModeRow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(
          child: _ModeCard(
            icon: Icons.view_column_outlined,
            title: "Élément isolé",
            description: "Poteau, voile ou poutre calculé seul",
          ),
        ),
        SizedBox(width: 12),
        Expanded(
          child: _ModeCard(
            icon: Icons.apartment_outlined,
            title: "Bâtiment complet",
            description: "Modélisation multi-étages du système porteur",
          ),
        ),
      ],
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.accentBlue, size: 22),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            description,
            style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary, height: 1.3),
          ),
        ],
      ),
    );
  }
}
