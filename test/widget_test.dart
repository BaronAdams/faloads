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

    // The dashboard's content is taller than the test surface, and
    // ListView — even with a plain `children:` list, not `.builder` — only
    // mounts children within the current viewport (plus a small cache
    // extent): everything below "Prédimensionnement" genuinely isn't built
    // yet until scrolled into view. That's correct, ordinary Sliver
    // behavior, not a bug — the earlier "0 widgets found" failures here
    // were the test not scrolling, not the app failing to render.
    await tester.scrollUntilVisible(
      find.text("Descente de charges"),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text("Descente de charges"), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text("Projets récents"),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text("Projets récents"), findsOneWidget);
  });
}
