import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:structcalc/src/theme/app_colors.dart';
import 'package:structcalc/src/theme/app_theme.dart';
import 'package:structcalc/src/ui/calculators/workspace/calculator_forms.dart';
import 'package:structcalc/src/ui/calculators/workspace/calculator_model.dart';
import 'package:structcalc/src/ui/calculators/workspace/calculator_page.dart';
import 'package:structcalc/src/ui/calculators/workspace/calculator_playground.dart';

Future<void> pumpPage(WidgetTester tester, CalculatorKind kind,
    {Size size = const Size(390, 844), double textScale = 1}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(() => tester.view.resetViewInsets());
  AppColors.setBrightness(Brightness.dark);
  await tester.pumpWidget(MaterialApp(
      theme: AppTheme.dark,
      builder: (context, child) =>
          MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)), child: child!),
      home: RepaintBoundary(key: const Key('calculator-preview'), child: CalculatorPage(kind: kind))));
  await tester.pumpAndSettle();
}

Finder input(String label) => find.byKey(ValueKey('calculator-input-$label'));

void main() {
  setUpAll(() async {
    for (final (family, path) in [
      (AppTheme.uiFontFamily, 'assets/fonts/DMSans-Variable.ttf'),
      (AppTheme.monoFontFamily, 'assets/fonts/JetBrainsMono-Variable.ttf'),
      ('MaterialIcons', 'fonts/MaterialIcons-Regular.otf')
    ]) {
      await (FontLoader(family)..addFont(rootBundle.load(path))).load();
    }
  });
  setUp(() => SharedPreferences.setMockInitialValues({}));
  tearDown(() => AppColors.setBrightness(Brightness.dark));

  for (final kind in CalculatorKind.values) {
    for (final desktop in [false, true]) {
      testWidgets('${kind.name}: ${desktop ? 'desktop' : 'mobile'} reference layout and typography', (tester) async {
        await pumpPage(tester, kind, size: desktop ? const Size(1440, 1000) : const Size(390, 844));
        expect(tester.takeException(), isNull);
        if (!desktop) expect(find.byType(BottomNavigationBar), findsOneWidget);
        final field = tester.widget<TextFormField>(input(desktop && kind == CalculatorKind.frame
                ? 'Largeur b'
                : kind == CalculatorKind.beam
                    ? 'Longueur'
                    : 'Module E')
            .first);
        final editable =
            tester.widget<TextField>(find.descendant(of: find.byWidget(field), matching: find.byType(TextField)).first);
        expect(editable.style!.fontFamily, AppTheme.monoFontFamily);
        expect(Theme.of(tester.element(find.byType(CalculatorPage))).textTheme.bodyMedium!.fontFamily,
            AppTheme.uiFontFamily);
        await expectLater(find.byKey(const Key('calculator-preview')),
            matchesGoldenFile('goldens/calculator_${kind.name}_${desktop ? 'desktop' : 'mobile'}.png'));
      });
    }
  }

  testWidgets('mobile tabs retain the draft and camera zoom/pan/recenter does not change the model', (tester) async {
    await pumpPage(tester, CalculatorKind.beam);
    await tester.tap(find.text('Schéma').last);
    await tester.pumpAndSettle();
    final viewer = tester.widget<InteractiveViewer>(find.byKey(const Key('calculator-interactive-viewer')).first);
    final before = List<double>.of(viewer.transformationController!.value.storage);
    await tester.ensureVisible(find.byKey(const Key('calculator-zoom-in')).first);
    await tester.tap(find.byKey(const Key('calculator-zoom-in')).first);
    await tester.pumpAndSettle();
    expect(viewer.transformationController!.value.getMaxScaleOnAxis(), greaterThan(1));
    expect(find.textContaining('Modèle personnalisé'), findsNothing);
    await tester.tap(find.byKey(const Key('calculator-recenter')).first);
    await tester.pumpAndSettle();
    expect(viewer.transformationController!.value.storage, before);
    await tester.ensureVisible(find.byKey(const Key('calculator-scene')).first);
    await tester.pumpAndSettle();
    await tester.timedDrag(
        find.byKey(const Key('calculator-scene')).first, const Offset(70, 15), const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(viewer.transformationController!.value.storage, isNot(before));
    expect(find.textContaining('Modèle personnalisé'), findsNothing);
    await tester.tap(find.text('Modèle').last);
    await tester.pumpAndSettle();
    expect(tester.widget<TextFormField>(input('Longueur')).initialValue, '8,00');
    expect(tester.takeException(), isNull);
  });

  testWidgets('comma input applies to the model, hides stale results and supports undo', (tester) async {
    await pumpPage(tester, CalculatorKind.beam, size: const Size(1440, 1000));
    await tester.enterText(input('Longueur'), '9,50');
    await tester.ensureVisible(find.byKey(const Key('apply-model')));
    await tester.tap(find.byKey(const Key('apply-model')));
    await tester.pumpAndSettle();
    expect(find.text('Modèle personnalisé'), findsOneWidget);
    expect(find.textContaining('Aucun résultat de calcul'), findsOneWidget);
    expect(find.text('111,00'), findsNothing);
    await tester.tap(find.byTooltip('Annuler la modification'));
    await tester.pumpAndSettle();
    expect(find.text('111,00'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('invalid numeric fields do not silently clamp or alter the applied model', (tester) async {
    await pumpPage(tester, CalculatorKind.beam, size: const Size(1440, 1000));
    await tester.enterText(input('Longueur'), '0');
    await tester.ensureVisible(find.byKey(const Key('apply-model')));
    await tester.tap(find.byKey(const Key('apply-model')));
    await tester.pumpAndSettle();
    expect(find.textContaining('Minimum :'), findsWidgets);
    expect(find.text('Modèle personnalisé'), findsNothing);
  });

  testWidgets('load editor is keyboard-safe, applies values and Cancel discards changes', (tester) async {
    await pumpPage(tester, CalculatorKind.beam);
    await tester.tap(find.text('Schéma').last);
    await tester.pumpAndSettle();
    final scene = find.byKey(const Key('calculator-scene')).first;
    final box = tester.getRect(scene);
    final geometry = CalculatorSceneGeometry(CalculatorModel.reference(CalculatorKind.beam), box.size);
    await tester.tapAt(box.topLeft + geometry.point(2, 0) + const Offset(0, -18));
    await tester.pumpAndSettle();
    expect(find.text('Charge répartie q1'), findsOneWidget);
    await tester.enterText(input('Intensité'), '18,50');
    await tester.tap(find.text('Annuler'));
    await tester.pumpAndSettle();
    expect(find.text('Modèle personnalisé'), findsNothing);
    await tester.tapAt(box.topLeft + geometry.point(2, 0) + const Offset(0, -18));
    await tester.pumpAndSettle();
    tester.view.viewInsets = const FakeViewPadding(bottom: 260);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.enterText(input('Intensité'), '18,50');
    await tester.tap(find.byKey(const Key('apply-element')));
    await tester.pumpAndSettle();
    tester.view.resetViewInsets();
    await tester.pumpAndSettle();
    expect(find.text('Modèle personnalisé'), findsOneWidget);
    expect(find.byType(CalculatorElementForm), findsNothing);
  });

  testWidgets('frame node selection edits coordinates and force independently from the camera', (tester) async {
    await pumpPage(tester, CalculatorKind.frame);
    await tester.tap(find.text('N2 · Aucun'));
    await tester.pumpAndSettle();
    expect(find.text('Nœud N2'), findsOneWidget);
    expect(input('X'), findsOneWidget);
    expect(input('Y'), findsOneWidget);
    await tester.enterText(input('X'), '-0,50');
    await tester.enterText(input('Fx'), '20');
    await tester.tap(find.byKey(const Key('apply-element')));
    await tester.pumpAndSettle();
    expect(find.text('Modèle personnalisé'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('adding an element is provisional until Apply and can be undone', (tester) async {
    await pumpPage(tester, CalculatorKind.beam);
    await tester.tap(find.text('Schéma').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Ajouter').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Force ponctuelle'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Annuler'));
    await tester.pumpAndSettle();
    expect(find.text('Modèle personnalisé'), findsNothing);
    await tester.tap(find.widgetWithText(OutlinedButton, 'Ajouter').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Force ponctuelle'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('apply-element')));
    await tester.pumpAndSettle();
    expect(find.text('Modèle personnalisé'), findsOneWidget);
    await tester.tap(find.byTooltip('Annuler la modification'));
    await tester.pumpAndSettle();
    expect(find.text('Modèle personnalisé'), findsNothing);
  });

  testWidgets('saved calculator models are restored on opening', (tester) async {
    await pumpPage(tester, CalculatorKind.beam);
    await tester.enterText(input('Longueur'), '10');
    await tester.scrollUntilVisible(find.byKey(const Key('apply-model')), 250,
        scrollable: find.byType(Scrollable).first);
    await tester.tap(find.byKey(const Key('apply-model')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('save-calculator')));
    await tester.pumpAndSettle();
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('structcalc.calculator.beam.v1'), contains('10.0'));
    await tester.pumpWidget(const SizedBox());
    await pumpPage(tester, CalculatorKind.beam);
    expect(tester.widget<TextFormField>(input('Longueur')).initialValue, '10,00');
  });

  for (final kind in CalculatorKind.values) {
    testWidgets('${kind.name}: narrow screen, enlarged text and window resizing', (tester) async {
      await pumpPage(tester, kind, size: const Size(320, 700), textScale: 1.5);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Schéma').last);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      tester.view.physicalSize = const Size(1200, 900);
      await tester.pumpAndSettle();
      expect(find.byType(BottomNavigationBar), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }
}
