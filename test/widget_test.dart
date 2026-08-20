import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:structcalc/src/state/app_scope.dart";
import "package:structcalc/src/state/app_state.dart";
import "package:structcalc/src/theme/app_theme.dart";
import "package:structcalc/src/ui/shell/app_shell.dart";
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

  testWidgets("Skipping onboarding reaches the paywall", (tester) async {
    await tester.pumpWidget(const StructCalcApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text("Commencer"));
    await tester.pumpAndSettle();

    await tester.tap(find.text("Passer"));
    await tester.pumpAndSettle();

    expect(find.text("Choisissez votre formule"), findsOneWidget);

    await tester.tap(find.text("Continuer gratuitement"));
    await tester.pumpAndSettle();

    // The shell is up — Calculs is always present regardless of which
    // dashboard content ends up rendered; the dashboard's own content is
    // covered directly (and independently of this navigation chain) below.
    expect(find.text("Calculs"), findsWidgets);
  });

  testWidgets("the dashboard shows both calculation sections", (tester) async {
    final appState = AppState()
      ..completeOnboarding()
      ..continueWithoutSubscription();

    await tester.pumpWidget(
      AppScope(
        notifier: appState,
        child: MaterialApp(theme: AppTheme.dark, home: const AppShell()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Prédimensionnement"), findsOneWidget);
    expect(find.text("Descente de charges"), findsOneWidget);
    expect(find.text("Projets récents"), findsOneWidget);
  });
}
