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

  testWidgets("a dimension type can be created and applied from the node sheet directly", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    final canvasOrigin = tester.getTopLeft(find.byKey(const Key("buildingPlanCanvasPaint")));
    await tester.tapAt(canvasOrigin + const Offset(75, 75));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Modifier"));
    await tester.pumpAndSettle();

    // No presets saved yet: the sheet says so, but still offers the "+" —
    // this used to be a dead end (the whole picker was hidden instead).
    expect(find.text("Aucune dimension type enregistrée."), findsOneWidget);
    expect(find.text("Dimension type"), findsNothing);

    await tester.tap(find.byTooltip("Nouvelle dimension type"));
    await tester.pumpAndSettle();
    expect(find.text("Dimensions types"), findsOneWidget); // preset manager, pre-scoped to Poteaux

    await tester.enterText(find.widgetWithText(TextField, "Nom (ex. PTR30_40)"), "PTR30_40");
    await tester.tap(find.text("Ajouter"));
    await tester.pumpAndSettle();
    await tester.tap(find.text("Fermer"));
    await tester.pumpAndSettle();

    // Back in the (still open) node sheet: the picker is now reachable.
    expect(find.text("Dimension type"), findsOneWidget);
    expect(find.text("Personnalisé"), findsOneWidget);

    await tester.tap(find.text("Personnalisé"));
    await tester.pumpAndSettle();
    await tester.tap(find.text("PTR30_40"));
    await tester.pumpAndSettle();

    expect(find.text("PTR30_40"), findsOneWidget); // now the picker's own displayed value
  });

  testWidgets("walks all 3 steps and results shows tabs", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    await next(tester); // -> Vent
    expect(find.text("Zone de vent"), findsOneWidget);
    expect(find.text("Direction du vent"), findsOneWidget);

    await next(tester); // -> Résultats
    // The results panel is a draggable sheet starting collapsed to a
    // handle + tab bar, so the plan (with its bisector-split surfaces
    // d'influence) stays fully visible underneath by default.
    expect(find.text("Poteaux"), findsWidgets);
    expect(find.text("Poutres"), findsOneWidget);
    expect(find.text("Voiles"), findsOneWidget);

    // Tapping a beam on the still-mostly-uncovered plan must not throw.
    final canvasOrigin = tester.getTopLeft(find.byKey(const Key("buildingPlanCanvasPaint")));
    await tester.tapAt(canvasOrigin + const Offset(159, 75)); // top edge of panel (0,0)
    await tester.pumpAndSettle();

    await tester.tap(find.text("Poutres"));
    await tester.pumpAndSettle();

    // Drag the sheet's handle up to read the tables underneath.
    await tester.drag(find.byKey(const Key("resultsSheetHandle")), const Offset(0, -400));
    await tester.pumpAndSettle();

    // The default 3×2 grid has never been tapped cell-by-cell, but every
    // cell still defaults to an existing slab panel (FloorModel.
    // panelOrDefault), so the Poutres tab must already carry a real row
    // instead of the "nothing modelled yet" message. Checking the first
    // row rather than the ListView's trailing caption — the list doesn't
    // scroll on its own, and an item further down isn't guaranteed to be
    // mounted without scrolling to it.
    expect(find.text("Aucune poutre chargée sur cet étage."), findsNothing);
    expect(find.text("Poutre 1·1"), findsOneWidget);

    await tester.tap(find.text("Poteaux"));
    await tester.pumpAndSettle();
    expect(find.text("Aucun poteau chargé sur cet étage."), findsNothing);
    expect(find.text("1A"), findsOneWidget);

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
