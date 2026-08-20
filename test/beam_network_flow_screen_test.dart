import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:structcalc/src/theme/app_theme.dart";
import "package:structcalc/src/ui/beam_network/beam_network_flow_screen.dart";
import "package:structcalc/src/widgets/number_field.dart";

void main() {
  Future<void> pumpFlowFromAHomeScreen(WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.dark,
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const BeamNetworkFlowScreen()),
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

  testWidgets("step 1 shows one span field and one beam row per travée", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    expect(find.text("Travée X1"), findsOneWidget);
    expect(find.text("Travée X3"), findsOneWidget);
    expect(find.text("Travée Y1"), findsOneWidget);
    expect(find.text("Travée Y2"), findsOneWidget);

    // nx=3 -> 3 column-segments per row-line, ny+1=3 row-lines -> 9 horizontal rows.
    expect(find.textContaining("Poutre H"), findsNWidgets(9));
    // ny=2 -> 2 row-segments per column-line, nx+1=4 column-lines -> 8 vertical rows.
    expect(find.textContaining("Poutre V"), findsNWidgets(8));
  });

  testWidgets("increasing nx adds another span field and more beam rows", (tester) async {
    await pumpFlowFromAHomeScreen(tester);
    expect(find.text("Travée X4"), findsNothing);

    final nxField = find.descendant(
      of: find.ancestor(of: find.text("Travées X (nx)"), matching: find.byType(NumberField)),
      matching: find.byType(TextFormField),
    );
    await tester.enterText(nxField, "4");
    await tester.pumpAndSettle();

    expect(find.text("Travée X4"), findsOneWidget);
    // ny+1=3 row-lines × nx=4 segments now.
    expect(find.textContaining("Poutre H"), findsNWidgets(12));
  });

  testWidgets("step 2 grid has nx × ny tappable cells, all empty by default", (tester) async {
    await pumpFlowFromAHomeScreen(tester);
    await next(tester); // -> Dalles

    expect(find.text("Touchez une case pour lui assigner un panneau de dalle."), findsOneWidget);
    expect(find.text("—"), findsNWidgets(3 * 2)); // nx × ny empty-mode cells
  });

  testWidgets("assigning a panel via its sheet updates the grid cell live", (tester) async {
    await pumpFlowFromAHomeScreen(tester);
    await next(tester); // -> Dalles

    final firstCell = find.descendant(of: find.byType(GridView), matching: find.byType(InkWell)).first;
    await tester.tap(firstCell);
    await tester.pumpAndSettle();

    expect(find.text("Panneau de dalle"), findsOneWidget);
    await tester.tap(find.text("Contour complet"));
    await tester.pumpAndSettle();

    // Slab-specific fields only appear once the mode is no longer "Vide".
    expect(find.text("Type de dalle"), findsOneWidget);
    // The grid cell behind the sheet already reflects the new mode.
    expect(find.text("✓"), findsOneWidget);
  });

  testWidgets("step 3 shows an empty-state message when no panel is assigned", (tester) async {
    await pumpFlowFromAHomeScreen(tester);
    await next(tester); // -> Dalles
    await next(tester); // -> Résultats

    expect(find.textContaining("Aucune poutre active ne porte de charge"), findsOneWidget);
  });

  testWidgets("the stepper header only allows tapping already-reached steps", (tester) async {
    await pumpFlowFromAHomeScreen(tester);

    await tester.tap(find.text("Résultats"));
    await tester.pumpAndSettle();
    expect(find.text("Travées X (nx)"), findsOneWidget);
  });

  testWidgets("finishing the flow pops back to the launching screen", (tester) async {
    await pumpFlowFromAHomeScreen(tester);
    await next(tester);
    await next(tester);

    await tester.tap(find.textContaining("Terminer"));
    await tester.pumpAndSettle();
    expect(find.text("Ouvrir"), findsOneWidget);
  });
}
