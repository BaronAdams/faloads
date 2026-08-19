import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:structcalc/main.dart";

void main() {
  testWidgets("Landing screen renders and leads into onboarding", (tester) async {
    await tester.pumpWidget(const StructCalcApp());
    await tester.pumpAndSettle();

    expect(find.text("StructCalc"), findsOneWidget);
    expect(find.text("Commencer"), findsOneWidget);

    await tester.tap(find.text("Commencer"));
    await tester.pumpAndSettle();

    expect(find.text("Passer"), findsOneWidget);
  });

  testWidgets("Skipping onboarding reaches the paywall and shell", (tester) async {
    await tester.pumpWidget(const StructCalcApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text("Commencer"));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Passer"));
    await tester.pumpAndSettle();

    expect(find.text("Choisissez votre formule"), findsOneWidget);

    await tester.tap(find.text("Continuer gratuitement"));
    await tester.pumpAndSettle();

    expect(find.text("Calculs"), findsWidgets);
    expect(find.text("Prédimensionnement"), findsOneWidget);
    expect(find.text("Descente de charges"), findsOneWidget);
  });
}
