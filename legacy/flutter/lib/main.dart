import "package:flutter/material.dart";

import "src/state/app_scope.dart";
import "src/state/app_state.dart";
import "src/theme/app_colors.dart";
import "src/theme/app_theme.dart";
import "src/ui/onboarding/landing_screen.dart";
import "src/ui/shell/app_shell.dart";

void main() {
  runApp(const StructCalcApp());
}

class StructCalcApp extends StatefulWidget {
  const StructCalcApp({super.key});

  @override
  State<StructCalcApp> createState() => _StructCalcAppState();
}

class _StructCalcAppState extends State<StructCalcApp> {
  final _appState = AppState();

  // Startup routing must wait on this: home: always started at
  // LandingScreen regardless of persisted state, so the onboarding
  // sequence replayed on every launch instead of only the first one after
  // install — the screen shown before loadPersisted() resolves is a blank
  // background matching the theme, not a flash of the wrong screen.
  late final Future<void> _ready = _appState.loadPersisted();

  @override
  void initState() {
    super.initState();
    // AppScope only rebuilds *descendants* that read it via
    // AppScope.of(context) — this State creates AppScope, so it doesn't
    // get that for free and needs its own listener to react to e.g. a
    // theme-mode change (which this build() itself consumes).
    _appState.addListener(_onAppStateChanged);
  }

  void _onAppStateChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _appState.removeListener(_onAppStateChanged);
    _appState.dispose();
    super.dispose();
  }

  ThemeMode _materialThemeMode(AppThemeMode mode) => switch (mode) {
        AppThemeMode.light => ThemeMode.light,
        AppThemeMode.dark => ThemeMode.dark,
        AppThemeMode.system => ThemeMode.system,
      };

  @override
  Widget build(BuildContext context) {
    // AppColors' neutral tones are plain static getters (not driven by
    // Theme.of(context)) so every one of the ~170 existing call sites
    // across the app keeps working unchanged — this is the one place that
    // decides which palette they resolve to, kept in sync with whatever
    // brightness MaterialApp is about to render with.
    final resolvedBrightness = switch (_appState.themeMode) {
      AppThemeMode.light => Brightness.light,
      AppThemeMode.dark => Brightness.dark,
      AppThemeMode.system => MediaQuery.platformBrightnessOf(context),
    };
    AppColors.setBrightness(resolvedBrightness);

    return AppScope(
      notifier: _appState,
      child: MaterialApp(
        title: "StructCalc",
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: _materialThemeMode(_appState.themeMode),
        home: FutureBuilder<void>(
          future: _ready,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return ColoredBox(color: AppColors.background);
            }
            return _appState.isLoggedIn ? const AppShell() : const LandingScreen();
          },
        ),
      ),
    );
  }
}
