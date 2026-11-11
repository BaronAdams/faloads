import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:structcalc/main.dart';
import 'package:structcalc/src/state/app_state.dart';
import 'package:structcalc/src/state/presets.dart';
import 'package:structcalc/src/state/saved_project.dart';
import 'package:structcalc/src/ui/calculators/beam_calc_screen.dart';
import 'package:structcalc/src/ui/shell/app_shell.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('startup shows progress and a recovery screen when the store never answers', (tester) async {
    final pending = Completer<SharedPreferences>();
    final state = AppState(preferencesLoader: () => pending.future, persistenceTimeout: const Duration(seconds: 1));
    await tester.pumpWidget(StructCalcApp(appState: state));
    expect(find.text('Ouverture de StructCalc'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    await tester.pump();
    expect(find.text('Ouverture interrompue'), findsOneWidget);
    expect(find.text('Réessayer'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a platform failure is recoverable and retry restores the saved session', (tester) async {
    var attempts = 0;
    SharedPreferences.setMockInitialValues({
      'structcalc.session.v1': jsonEncode({'isLoggedIn': true, 'hasSeenOnboarding': true}),
    });
    final state = AppState(preferencesLoader: () async {
      if (++attempts == 1) throw StateError('disk unavailable');
      return SharedPreferences.getInstance();
    });
    await tester.pumpWidget(StructCalcApp(appState: state));
    await tester.pumpAndSettle();
    expect(find.text('Ouverture interrompue'), findsOneWidget);
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();
    expect(find.byType(AppShell), findsOneWidget);
    expect(attempts, 2);
    expect(tester.takeException(), isNull);
  });

  testWidgets('corrupt data is preserved and a temporary session never writes over it', (tester) async {
    const broken = 'not valid JSON';
    SharedPreferences.setMockInitialValues({'structcalc.projects.v1': broken});
    final state = AppState();
    await tester.pumpWidget(StructCalcApp(appState: state));
    await tester.pumpAndSettle();
    expect(find.text('Ouverture interrompue'), findsOneWidget);
    await tester.tap(find.text('Continuer sans sauvegarde'));
    await tester.pumpAndSettle();
    expect(find.text('Commencer'), findsOneWidget);
    expect(state.isTemporarySession, isTrue);
    expect(find.textContaining('Session temporaire'), findsOneWidget);
    state.completeOnboarding();
    state.addPreset(PresetCategory.poteau, DimensionPreset(name: 'temporary', aCm: 30));
    state.setThemeMode(AppThemeMode.light);
    await tester.pumpAndSettle();
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('structcalc.projects.v1'), broken);
    expect(prefs.getKeys(), {'structcalc.projects.v1'});
    expect(tester.takeException(), isNull);
  });

  test('all state writes are disabled in temporary sessions', () async {
    var storageCalls = 0;
    final state = AppState(preferencesLoader: () async {
      storageCalls++;
      return SharedPreferences.getInstance();
    })
      ..continueWithoutPersistence();
    addTearDown(state.dispose);
    state.logIn();
    state.completeOnboarding();
    state.setThemeMode(AppThemeMode.light);
    state.addPreset(PresetCategory.poteau, DimensionPreset(name: 'Temp', aCm: 30));
    state.saveProject(id: 'temp', type: SavedProjectType.poteau, name: 'Temp', data: {});
    await Future<void>.delayed(Duration.zero);
    expect(storageCalls, 0);
  });

  test('failed restore is atomic and retry cannot duplicate presets', () async {
    SharedPreferences.setMockInitialValues({
      'structcalc.presets.v1': jsonEncode({
        'poteau': [
          {'name': 'P30', 'aCm': 30}
        ]
      }),
      'structcalc.projects.v1': 'broken',
    });
    final state = AppState();
    addTearDown(state.dispose);
    await expectLater(state.loadPersisted(), throwsFormatException);
    expect(state.presets[PresetCategory.poteau], isEmpty);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('structcalc.projects.v1');
    await state.loadPersisted();
    await state.loadPersisted();
    expect(state.presets[PresetCategory.poteau]!.length, 1);
  });

  test('a late preference result cannot overwrite the temporary session', () async {
    final pending = Completer<SharedPreferences>();
    final state = AppState(preferencesLoader: () => pending.future);
    addTearDown(state.dispose);
    final ready = state.loadPersisted();
    state.continueWithoutPersistence();
    state.logIn();
    SharedPreferences.setMockInitialValues({
      'structcalc.session.v1': jsonEncode({'isLoggedIn': false})
    });
    pending.complete(await SharedPreferences.getInstance());
    await ready;
    expect(state.isLoggedIn, isTrue);
    expect(state.isTemporarySession, isTrue);
  });

  test('a late load after disposal does not notify listeners', () async {
    final pending = Completer<SharedPreferences>();
    final state = AppState(preferencesLoader: () => pending.future);
    final ready = state.loadPersisted();
    state.dispose();
    pending.complete(await SharedPreferences.getInstance());
    await ready;
  });

  test('background persistence errors are handled', () async {
    final state = AppState(preferencesLoader: () async => throw StateError('write failed'));
    addTearDown(state.dispose);
    state.logIn();
    await Future<void>.delayed(Duration.zero);
    expect(state.isLoggedIn, isTrue);
  });

  testWidgets('calculator save is disabled during a temporary session', (tester) async {
    final state = AppState()..continueWithoutPersistence();
    await tester.pumpWidget(StructCalcApp(appState: state));
    await tester.pumpAndSettle();
    final context = tester.element(find.text('Commencer'));
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const BeamCalcScreen()));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.save_outlined).first);
    await tester.pumpAndSettle();
    expect(find.text('Sauvegarde désactivée pendant la session temporaire.'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getKeys(), isEmpty);
    expect(tester.takeException(), isNull);
  });
}
