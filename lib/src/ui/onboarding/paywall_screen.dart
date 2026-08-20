import "package:flutter/material.dart";

import "../../state/app_scope.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_theme.dart";
import "../../widgets/primary_cta.dart";
import "../shell/app_shell.dart";

enum _Period { monthly, annual }

/// Paywall (spec §9): monthly/annual toggle (annual −20%), free vs pro plan
/// comparison, 7-day free trial CTA, and a "continue for free" escape
/// hatch. Subscribing logs the account in automatically.
class PaywallScreen extends StatefulWidget {
  const PaywallScreen({super.key});

  @override
  State<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends State<PaywallScreen> {
  _Period _period = _Period.annual;

  void _enterApp(BuildContext context, {required bool subscribe}) {
    final app = AppScope.of(context);
    app.completeOnboarding();
    if (subscribe) {
      app.startFreeTrial();
    } else {
      app.continueWithoutSubscription();
    }
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AppShell()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                "Choisissez votre formule",
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              const Text(
                "Débloquez le bâtiment complet, le réseau de poutres et l'export.",
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),
              _PeriodToggle(
                period: _period,
                onChanged: (p) => setState(() => _period = p),
              ),
              const SizedBox(height: 16),
              const _PlanCard(
                title: "Gratuit",
                price: "0 €",
                features: [
                  "Prédimensionnement (tous types)",
                  "Poteau isolé / voile isolé",
                  "1 projet enregistré",
                ],
                highlighted: false,
              ),
              const SizedBox(height: 12),
              _PlanCard(
                title: "Pro",
                price: _period == _Period.annual ? "9,60 €/mois · facturé annuellement" : "12 €/mois",
                features: const [
                  "Tout le Gratuit",
                  "Réseau de poutres & bâtiment complet",
                  "Projets illimités, étages dupliquables",
                  "Export PDF / Excel",
                ],
                highlighted: true,
                badge: _period == _Period.annual ? "-20%" : null,
              ),
              const SizedBox(height: 24),
              PrimaryCta(
                label: "Démarrer l'essai gratuit de 7 jours",
                onPressed: () => _enterApp(context, subscribe: true),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => _enterApp(context, subscribe: false),
                child: const Text("Continuer gratuitement"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PeriodToggle extends StatelessWidget {
  const _PeriodToggle({required this.period, required this.onChanged});

  final _Period period;
  final ValueChanged<_Period> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: _ToggleOption(
              label: "Mensuel",
              selected: period == _Period.monthly,
              onTap: () => onChanged(_Period.monthly),
            ),
          ),
          Expanded(
            child: _ToggleOption(
              label: "Annuel  ·  -20%",
              selected: period == _Period.annual,
              onTap: () => onChanged(_Period.annual),
            ),
          ),
        ],
      ),
    );
  }
}

class _ToggleOption extends StatelessWidget {
  const _ToggleOption({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.accentBlue : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.title,
    required this.price,
    required this.features,
    required this.highlighted,
    this.badge,
  });

  final String title;
  final String price;
  final List<String> features;
  final bool highlighted;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: highlighted ? AppColors.surfaceRaised : AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: highlighted ? AppColors.accentBlue : AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              if (badge != null) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.accentBlue.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    badge!,
                    style: const TextStyle(fontSize: 10.5, color: AppColors.accentBlue, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
              const Spacer(),
              Text(
                price,
                style: AppTheme.monoTextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...features.map(
            (f) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Icon(
                    Icons.check,
                    size: 15,
                    color: highlighted ? AppColors.accentBlue : AppColors.textTertiary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: Text(f, style: const TextStyle(fontSize: 12.5))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
