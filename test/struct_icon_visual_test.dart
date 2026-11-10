import "dart:ui" as ui;

import "package:flutter/material.dart";
import "package:flutter/rendering.dart";
import "package:flutter/services.dart";
import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:structcalc/src/state/app_scope.dart";
import "package:structcalc/src/state/app_state.dart";
import "package:structcalc/src/theme/app_colors.dart";
import "package:structcalc/src/theme/app_theme.dart";
import "package:structcalc/src/ui/dashboard/dashboard_screen.dart";
import "package:structcalc/src/widgets/struct_icon.dart";

// IDs refer to the user-approved design boards, not implementation variants.
const _selected = [
  ("01C", "Calculateur de poutres", StructIconKind.beamUdl, StructIconAnnotation.none),
  ("02B", "Calculateur de cadres", StructIconKind.portalFrame, StructIconAnnotation.none),
  ("03C", "Poteau isolé", StructIconKind.column, StructIconAnnotation.load),
  ("04B", "Voile isolé", StructIconKind.wall, StructIconAnnotation.load),
  ("05B", "Bâtiment complet", StructIconKind.building, StructIconAnnotation.load),
  ("06C", "Poteau", StructIconKind.column, StructIconAnnotation.rebar),
  ("07B", "Poutre", StructIconKind.beam, StructIconAnnotation.rebar),
  ("08C", "Voile", StructIconKind.wall, StructIconAnnotation.rebar),
  ("09A", "Escalier", StructIconKind.stairs, StructIconAnnotation.rebar),
  ("10C", "Balcon", StructIconKind.balcony, StructIconAnnotation.rebar),
  ("11C", "Plancher", StructIconKind.slab, StructIconAnnotation.rebar),
  ("12B", "Mur de soutènement", StructIconKind.retainingWall, StructIconAnnotation.rebar),
  ("13C", "Semelle de fondation", StructIconKind.footing, StructIconAnnotation.rebar),
];

void main() {
  setUpAll(() async {
    final font = FontLoader("DM Sans")..addFont(rootBundle.load("assets/fonts/DMSans-Variable.ttf"));
    await font.load();
  });
  tearDown(() => AppColors.setBrightness(Brightness.dark));

  for (final brightness in Brightness.values) {
    testWidgets("selected icons match the ${brightness.name} preview at 88px and 48px", (tester) async {
      await tester.binding.setSurfaceSize(const Size(960, 1050));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      AppColors.setBrightness(brightness);
      await tester.pumpWidget(MaterialApp(
        theme: brightness == Brightness.dark ? AppTheme.dark : AppTheme.light,
        home: const Center(child: RepaintBoundary(key: ValueKey("catalogue"), child: _Catalogue())),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await expectLater(
          find.byKey(const ValueKey("catalogue")), matchesGoldenFile("goldens/struct_icons_${brightness.name}.png"));
    });
  }

  testWidgets("selected icons keep loads and projecting bars inside their allocated bounds", (tester) async {
    const margin = 8;
    for (final iconSize in [24, 48]) {
      for (final (id, _, kind, annotation) in _selected) {
        await tester.pumpWidget(Theme(
          data: AppTheme.dark,
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: Center(
                child: RepaintBoundary(
              key: const ValueKey("bounds"),
              child: SizedBox.square(
                dimension: (iconSize + 2 * margin).toDouble(),
                child: Center(child: StructIcon(kind: kind, size: iconSize.toDouble(), annotation: annotation)),
              ),
            )),
          ),
        ));
        await tester.pump();
        final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(const ValueKey("bounds")));
        final outsidePixels = await tester.runAsync(() async {
          final image = await boundary.toImage();
          final data = (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
          var count = 0;
          for (var y = 0; y < image.height; y++) {
            for (var x = 0; x < image.width; x++) {
              final outside = x < margin || y < margin || x >= margin + iconSize || y >= margin + iconSize;
              if (outside && data.getUint8((y * image.width + x) * 4 + 3) != 0) {
                count++;
              }
            }
          }
          image.dispose();
          return count;
        });
        expect(outsidePixels, 0, reason: "$id at ${iconSize}px must not overflow its paint bounds");
      }
    }
  });

  for (final scale in [1.0, 1.5]) {
    testWidgets("dashboard cards fit a 320px screen with text scale $scale", (tester) async {
      SharedPreferences.setMockInitialValues({});
      await tester.binding.setSurfaceSize(const Size(320, 700));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final state = AppState();
      addTearDown(state.dispose);
      await tester.pumpWidget(AppScope(
        notifier: state,
        child: MaterialApp(
          theme: AppTheme.dark,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
            child: child!,
          ),
          home: const DashboardScreen(),
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      for (final label in ["Bâtiment complet", "Mur de soutènement", "Semelle de fondation"]) {
        await tester.scrollUntilVisible(find.text(label), 150, scrollable: find.byType(Scrollable).first);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: label);
      }
    });
  }
}

class _Catalogue extends StatelessWidget {
  const _Catalogue();

  Widget _row(int start, int end) => Row(children: [
        for (final (id, label, kind, annotation) in _selected.sublist(start, end))
          Expanded(
              child: Container(
            height: 190,
            margin: const EdgeInsets.all(4),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(id, style: const TextStyle(color: AppColors.accentBlue, fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                StructIcon(kind: kind, size: 88, annotation: annotation),
                const SizedBox(width: 12),
                StructIcon(kind: kind, size: 48, annotation: annotation),
              ]),
              const Spacer(),
              Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ]),
          )),
      ]);

  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.background,
        child: SizedBox(
            width: 960,
            height: 1050,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text("StructCalc · Sélection finale",
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                const Text("Dessins Flutter · Aperçus en 88 px et en 48 px", style: TextStyle(fontSize: 16)),
                const SizedBox(height: 16),
                const Text("Calculateurs", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                _row(0, 2),
                const SizedBox(height: 10),
                const Text("Descente de charges", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                _row(2, 5),
                const SizedBox(height: 10),
                const Text("Dimensionnement béton armé", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                _row(5, 9),
                _row(9, 13),
              ]),
            )),
      );
}
