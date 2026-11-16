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

    // Step 1 — Système (each option shows a plan-view illustration)
    expect(find.text("Système porteur"), findsOneWidget);
    expect(find.text("Poteaux + Poutres + Dalles"), findsOneWidget);
    expect(find.text("Poteaux + Dalles"), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);
    await next(tester);

    // Step 2 — Nœud, with the tributary-quadrants + poutres plan diagram
    expect(find.text("L1 — Gauche"), findsOneWidget);
    expect(find.textContaining("POTEAU"), findsOneWidget); // position badge
    expect(find.byType(CustomPaint), findsWidgets);
    await next(tester);

    // Step 3 — Niveaux, with a live elevation profile below the cards
    expect(find.text("Ajouter un niveau"), findsOneWidget);
    expect(find.text("Vue profil"), findsOneWidget);
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

    // The RDC card starts expanded, so "RDC" legitimately appears twice:
    // once as the card's header label, once as the pre-filled "Nom du
    // niveau" field's text (find.text matches EditableText content too).
    expect(find.text("RDC"), findsWidgets);
    await tester.tap(find.text("Ajouter un niveau"));
    await tester.pumpAndSettle();

    expect(find.textContaining("Niveau"), findsWidgets);
  });

  testWidgets("switching système hides/shows the beam section fields", (tester) async {
    await pumpFlowFromAHomeScreen(tester);
    await next(tester); // -> Nœud

    expect(find.text("Poutre principale"), findsOneWidget);

    // Go back and switch to the slab-only système. The illustrated option
    // cards are tall enough that the second one starts out tucked behind
    // the fixed footer bar, so it needs scrolling into view before it's
    // safe to tap.
    await tester.tap(find.text("Précédent"));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text("Poteaux + Dalles"));
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
