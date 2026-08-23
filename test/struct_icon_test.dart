import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:structcalc/src/theme/app_theme.dart";
import "package:structcalc/src/widgets/struct_icon.dart";

void main() {
  testWidgets("every StructIconKind renders without throwing", (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(
        body: Wrap(
          children: [for (final kind in StructIconKind.values) StructIcon(kind: kind)],
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.byType(StructIcon), findsNWidgets(StructIconKind.values.length));
  });

  testWidgets("every kind renders with a dimensions or load annotation without throwing", (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(
        body: Wrap(
          children: [
            for (final kind in StructIconKind.values) StructIcon(kind: kind, annotation: StructIconAnnotation.dimensions),
            for (final kind in StructIconKind.values) StructIcon(kind: kind, annotation: StructIconAnnotation.load),
          ],
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.byType(StructIcon), findsNWidgets(StructIconKind.values.length * 2));
  });
}
