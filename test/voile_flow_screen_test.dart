import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:structcalc/src/theme/app_theme.dart";
import "package:structcalc/src/ui/voile/voile_flow_screen.dart";

void main() {
  Future<void> pumpFlowFromAHomeScreen(WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.dark,
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const VoileFlowScreen()),
              ),
              child: const Text("Ouvrir"),
            ),
          ),
        ),
      ),
    ));
    await tester.tap(find.text("Ouvrir"));
    await tester.pumpAndSettle();
  }

  Future<void> next(WidgetTester tester) async {
    await tester.tap(find.textContaining("Suivant"));
    await tester.pumpAndSettle();
  }

  testWidgets("walks all 5 steps, including the Vent EC1 block and F_vent results", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    // Step 1 — Système + Vent EC1
    expect(find.text("Vent EC1"), findsOneWidget);
    expect(find.text("Direction du vent"), findsOneWidget);
    await next(tester);

    // Step 2 — Aire tributaire
    expect(find.text("Longueur du voile"), findsOneWidget);
    expect(find.text("Portée avant"), findsOneWidget);
    expect(find.textContaining("Aire tributaire ="), findsOneWidget);
    await next(tester);

    // Step 3 — Niveaux (épaisseur, not b×h)
    expect(find.text("Épaisseur du voile"), findsOneWidget);
    await next(tester);

    // Step 4 — Récapitulatif
    expect(find.text("Longueur du voile"), findsOneWidget); // also in the recap block
    await next(tester);

    // Step 5 — Résultats
    expect(find.text("SECTION RECOMMANDÉE"), findsOneWidget);
    expect(find.textContaining("F_vent"), findsWidgets);

    await tester.tap(find.textContaining("Terminer"));
    await tester.pumpAndSettle();
    expect(find.text("Ouvrir"), findsOneWidget);
  });
}
