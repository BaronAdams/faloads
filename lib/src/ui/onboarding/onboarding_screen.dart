import "package:flutter/material.dart";

import "../../theme/app_colors.dart";
import "../../theme/app_theme.dart";
import "../../widgets/primary_cta.dart";
import "paywall_screen.dart";

class _Slide {
  const _Slide({required this.icon, required this.title, required this.body});

  final IconData icon;
  final String title;
  final Widget body;
}

/// 5-screen conversion onboarding shown once, before the paywall (spec §9):
/// time comparison, normative-compliance badges, feature checklist,
/// testimonial + social proof, final hook screen.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  late final List<_Slide> _slides = [
    _Slide(
      icon: Icons.speed_outlined,
      title: "Des heures gagnées sur chaque descente de charges",
      body: const _TimeCompareBody(),
    ),
    _Slide(
      icon: Icons.verified_outlined,
      title: "Conforme aux normes en vigueur",
      body: const _ComplianceBadgesBody(),
    ),
    _Slide(
      icon: Icons.checklist_outlined,
      title: "Tout ce qu'il faut pour une descente complète",
      body: const _FeatureChecklistBody(),
    ),
    _Slide(
      icon: Icons.groups_outlined,
      title: "Déjà adopté par des ingénieurs sur le terrain",
      body: const _TestimonialBody(),
    ),
    _Slide(
      icon: Icons.bolt_outlined,
      title: "Prêt à gagner des heures ?",
      body: const _FinalHookBody(),
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _next() {
    if (_index == _slides.length - 1) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const PaywallScreen()),
      );
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _slides.length - 1;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const PaywallScreen()),
                    ),
                    child: const Text("Passer"),
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => _SlideView(slide: _slides[i]),
              ),
            ),
            _ProgressDots(count: _slides.length, index: _index),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: PrimaryCta(
                label: isLast ? "Continuer" : "Suivant",
                icon: isLast ? null : Icons.arrow_forward,
                onPressed: _next,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});

  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.surfaceRaised,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Icon(slide.icon, color: AppColors.accentBlue, size: 24),
          ),
          const SizedBox(height: 20),
          Text(
            slide.title,
            style: const TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w700,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 24),
          Expanded(child: slide.body),
        ],
      ),
    );
  }
}

class _ProgressDots extends StatelessWidget {
  const _ProgressDots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final active = i == index;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 18 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: active ? AppColors.accentBlue : AppColors.border,
            borderRadius: BorderRadius.circular(3),
          ),
        );
      }),
    );
  }
}

// --- Slide 1: hand vs. StructCalc time comparison ---------------------

class _TimeCompareBody extends StatelessWidget {
  const _TimeCompareBody();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: const [
        _TimeBar(label: "À la main", fraction: 1.0, valueLabel: "≈ 2 h", color: AppColors.textTertiary),
        SizedBox(height: 16),
        _TimeBar(label: "Avec StructCalc", fraction: 0.12, valueLabel: "≈ 15 min", color: AppColors.accentBlue),
      ],
    );
  }
}

class _TimeBar extends StatelessWidget {
  const _TimeBar({
    required this.label,
    required this.fraction,
    required this.valueLabel,
    required this.color,
  });

  final String label;
  final double fraction;
  final String valueLabel;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            Text(
              valueLabel,
              style: AppTheme.monoTextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: fraction,
            minHeight: 10,
            backgroundColor: AppColors.surfaceRaised,
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
      ],
    );
  }
}

// --- Slide 2: normative compliance badges ------------------------------

class _ComplianceBadgesBody extends StatelessWidget {
  const _ComplianceBadgesBody();

  static const _badges = [
    "Eurocode 2 (EN 1992-1-1)",
    "BAEL 91",
    "Vent EC1",
    "Surfaces d'influence",
  ];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: _badges
          .map(
            (b) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, size: 15, color: AppColors.success),
                  const SizedBox(width: 8),
                  Text(b, style: const TextStyle(fontSize: 12.5)),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

// --- Slide 3: feature checklist -----------------------------------------

class _FeatureChecklistBody extends StatelessWidget {
  const _FeatureChecklistBody();

  static const _features = [
    "Poteaux, poutres, voiles isolés",
    "Bâtiment complet multi-étages",
    "Plan avec axes normés (A, B, C… / 1, 2, 3…)",
    "Duplication d'étage",
    "Prédimensionnement automatique",
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      shrinkWrap: true,
      children: _features
          .map(
            (f) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(
                children: [
                  const Icon(Icons.check, size: 18, color: AppColors.accentBlue),
                  const SizedBox(width: 10),
                  Expanded(child: Text(f, style: const TextStyle(fontSize: 14))),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

// --- Slide 4: testimonial + social proof --------------------------------

class _TestimonialBody extends StatelessWidget {
  const _TestimonialBody();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: const Text(
            "“Je vérifie mes descentes de charges directement sur "
            "chantier — plus besoin de retourner au bureau pour un "
            "prédimensionnement rapide.”",
            style: TextStyle(fontSize: 13.5, height: 1.5, fontStyle: FontStyle.italic),
          ),
        ),
        const SizedBox(height: 18),
        const Row(
          children: [
            Expanded(child: _StatBlock(value: "2 400+", label: "ingénieurs")),
            Expanded(child: _StatBlock(value: "38 000+", label: "calculs effectués")),
            Expanded(child: _StatBlock(value: "4.8/5", label: "note moyenne")),
          ],
        ),
      ],
    );
  }
}

class _StatBlock extends StatelessWidget {
  const _StatBlock({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: AppTheme.monoTextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 10.5, color: AppColors.textTertiary)),
      ],
    );
  }
}

// --- Slide 5: final hook --------------------------------------------------

class _FinalHookBody extends StatelessWidget {
  const _FinalHookBody();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text(
        "Un essai gratuit de 7 jours, sans engagement — passez à la "
        "suite pour choisir votre formule.",
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 14.5, color: AppColors.textSecondary, height: 1.5),
      ),
    );
  }
}
