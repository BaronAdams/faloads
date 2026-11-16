import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:structcalc/src/theme/app_theme.dart";
import "package:structcalc/src/ui/predim/predim_screen.dart";

void main() {
  Widget wrap(Widget child) {
    return MaterialApp(theme: AppTheme.dark, home: child);
  }

  testWidgets("defaults to Poteau and shows a result panel", (tester) async {
    await tester.pumpWidget(wrap(const PredimScreen()));
    await tester.pumpAndSettle();

    expect(find.text("Prédimensionnement"), findsOneWidget);
    expect(find.text("SECTION RECOMMANDÉE"), findsOneWidget);
    expect(find.text("N_ELU"), findsOneWidget);
    expect(find.text("Règlement"), findsOneWidget);
  });

  testWidgets("can start on a different type via initialType", (tester) async {
    await tester.pumpWidget(wrap(const PredimScreen(initialType: PredimElementType.escalier)));
    await tester.pumpAndSettle();

    expect(find.text("Hauteur à franchir"), findsOneWidget);
    expect(find.textContaining("Loi de Blondel"), findsOneWidget);
  });

  testWidgets("switching type chips swaps the parameter panel", (tester) async {
    await tester.pumpWidget(wrap(const PredimScreen()));
    await tester.pumpAndSettle();

    expect(find.text("Longueur"), findsNothing);

    await tester.tap(find.text("Voile"));
    await tester.pumpAndSettle();

    expect(find.text("Longueur"), findsOneWidget);
    expect(find.text("Béton"), findsOneWidget);

    await tester.tap(find.text("Poutre"));
    await tester.pumpAndSettle();

    expect(find.text("Type d'appui"), findsOneWidget);
    expect(find.text("Isostatique"), findsOneWidget);
  });

  testWidgets("editing a field recomputes the result", (tester) async {
    await tester.pumpWidget(wrap(const PredimScreen()));
    await tester.pumpAndSettle();

    String resultText() =>
        tester.widget<Text>(find.byKey(const Key("predimResultBig"))).data ?? "";

    final before = resultText();
    expect(before, isNotEmpty);

    await tester.enterText(find.byType(TextFormField).first, "3000");
    await tester.pumpAndSettle();

    expect(resultText(), isNot(equals(before)));
  });
}
