import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:structcalc/src/theme/app_theme.dart";
import "package:structcalc/src/ui/building/building_flow_screen.dart";

void main() {
  Future<void> pumpFlowFromAHomeScreen(WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.dark,
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const BuildingFlowScreen()),
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

  testWidgets("step 1 shows the floor bar, grid summary, and canvas", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    expect(find.text("RDC"), findsOneWidget); // default floor chip
    expect(find.textContaining("travées"), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);
  });

  testWidgets("tapping a node selects it and opens its edit sheet", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    // Node (0,0) sits at local (padding, padding) = (75, 75) with the
    // default floor's geometry (no pan/zoom applied yet).
    final canvasOrigin = tester.getTopLeft(find.byKey(const Key("buildingPlanCanvasPaint")));
    await tester.tapAt(canvasOrigin + const Offset(75, 75));
    await tester.pumpAndSettle();

    expect(find.text("Poteau 1A"), findsOneWidget); // selected-element bar
    expect(find.text("Modifier"), findsOneWidget);

    await tester.tap(find.text("Modifier"));
    await tester.pumpAndSettle();

    expect(find.text("Poteau 1A"), findsWidgets); // bar + sheet title
    expect(find.text("Supprimer ce poteau"), findsOneWidget);
  });

  testWidgets("adding a floor adds another chip to the floor bar", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    expect(find.text("RDC"), findsOneWidget);
    await tester.tap(find.byTooltip("Ajouter un étage"));
    await tester.pumpAndSettle();

    expect(find.text("Niveau 2"), findsOneWidget);
  });

  testWidgets("dimension preset manager adds a named preset", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    await tester.tap(find.byTooltip("Dimensions types"));
    await tester.pumpAndSettle();

    expect(find.text("Dimensions types"), findsOneWidget);
    expect(find.text("Poteaux"), findsWidgets); // category chip

    await tester.enterText(find.widgetWithText(TextField, "Nom (ex. PTR30_40)"), "PTR30_40");
    await tester.tap(find.text("Ajouter"));
    await tester.pumpAndSettle();

    expect(find.text("PTR30_40"), findsOneWidget);
  });

  testWidgets("walks all 3 steps and results shows tabs", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    await next(tester); // -> Vent
    expect(find.text("Zone de vent"), findsOneWidget);
    expect(find.text("Direction du vent"), findsOneWidget);

    await next(tester); // -> Résultats
    expect(find.text("Poteaux"), findsWidgets);
    expect(find.text("Poutres"), findsOneWidget);
    expect(find.text("Voiles"), findsOneWidget);

    await tester.tap(find.textContaining("Terminer"));
    await tester.pumpAndSettle();
    expect(find.text("Ouvrir"), findsOneWidget);
  });

  testWidgets("the stepper header only allows tapping already-reached steps", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    await tester.tap(find.text("Résultats"));
    await tester.pumpAndSettle();
    expect(find.textContaining("travées"), findsOneWidget);
  });
}
