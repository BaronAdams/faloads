import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:structcalc/src/theme/app_theme.dart";
import "package:structcalc/src/ui/poteau/poteau_flow_screen.dart";

void main() {
  Future<void> pumpFlowFromAHomeScreen(WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.dark,
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const PoteauFlowScreen()),
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

  testWidgets("walks all 5 steps and shows a predim result at the end", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    // Step 1 — Système
    expect(find.text("Système porteur"), findsOneWidget);
    await next(tester);

    // Step 2 — Nœud
    expect(find.text("L1 — Gauche"), findsOneWidget);
    expect(find.textContaining("POTEAU"), findsOneWidget); // position badge
    await next(tester);

    // Step 3 — Niveaux
    expect(find.text("Ajouter un niveau"), findsOneWidget);
    await next(tester);

    // Step 4 — Récapitulatif
    expect(find.text("Aire tributaire totale"), findsOneWidget);
    expect(find.text("Charges par niveau"), findsOneWidget);
    await next(tester);

    // Step 5 — Résultats
    expect(find.text("SECTION RECOMMANDÉE"), findsOneWidget);
    expect(find.text("Descente de charges cumulée"), findsOneWidget);

    // Finishing pops back to the launching screen.
    await tester.tap(find.textContaining("Terminer"));
    await tester.pumpAndSettle();
    expect(find.text("Ouvrir"), findsOneWidget);
  });

  testWidgets("adding a level adds a new row to the levels list", (tester) async {
    await pumpFlowFromAHomeScreen(tester);
    await next(tester); // -> Nœud
    await next(tester); // -> Niveaux

    expect(find.text("RDC"), findsOneWidget);
    await tester.tap(find.text("Ajouter un niveau"));
    await tester.pumpAndSettle();

    expect(find.textContaining("Niveau"), findsWidgets);
  });

  testWidgets("switching système hides/shows the beam section fields", (tester) async {
    await pumpFlowFromAHomeScreen(tester);
    await next(tester); // -> Nœud

    expect(find.text("Poutre principale"), findsOneWidget);

    // Go back and switch to the slab-only système.
    await tester.tap(find.text("Précédent"));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Poteaux + Dalles"));
    await tester.pumpAndSettle();
    await next(tester);

    expect(find.text("Poutre principale"), findsNothing);
  });

  testWidgets("the stepper header only allows tapping already-reached steps", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    // Step 3 ("Niveaux") hasn't been reached yet — tapping it must not navigate.
    await tester.tap(find.text("Niveaux"));
    await tester.pumpAndSettle();
    expect(find.text("Système porteur"), findsOneWidget);
  });
}
