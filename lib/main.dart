import "package:flutter/material.dart";

import "src/diagnostics/app_diagnostics.dart";
import "src/ui/startup/startup_screen.dart";

import "src/state/app_scope.dart";
import "src/state/app_state.dart";
import "src/theme/app_colors.dart";
import "src/theme/app_theme.dart";
import "src/ui/onboarding/landing_screen.dart";
import "src/ui/shell/app_shell.dart";

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    recordDiagnostic('flutter.error', error: details.exception, stackTrace: details.stack);
  };
  WidgetsBinding.instance.platformDispatcher.onError = (error, stack) {
    recordDiagnostic('async.error', error: error, stackTrace: stack);
    return false; // Keep the engine's normal reporting as well.
  };
  recordDiagnostic('startup.main');
  runApp(const StructCalcApp());
  WidgetsBinding.instance.addPostFrameCallback((_) => recordDiagnostic('startup.first_frame'));
}

class StructCalcApp extends StatefulWidget {
  const StructCalcApp({super.key, this.appState});

  final AppState? appState;

  @override
  State<StructCalcApp> createState() => _StructCalcAppState();
}

class _StructCalcAppState extends State<StructCalcApp> {
  late final AppState _appState = widget.appState ?? AppState();
  late Future<void> _ready;
  bool _startupReported = false;

  void _retryStartup() {
    final ready = _appState.loadPersisted();
    setState(() {
      _ready = ready;
    });
  }

  void _continueTemporarily() {
    _appState.continueWithoutPersistence();
    setState(() {
      _ready = Future<void>.value();
    });
  }

  @override
  void initState() {
    super.initState();
    _ready = _appState.loadPersisted();
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
        builder: (context, child) {
          if (!_appState.isTemporarySession) return child!;
          return Column(children: [
            Material(
              color: Theme.of(context).colorScheme.secondaryContainer,
              child: const SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: EdgeInsets.all(10),
                    child: Text('Session temporaire · Sauvegarde désactivée. Fermez puis relancez pour réessayer.',
                        textAlign: TextAlign.center),
                  )),
            ),
            Expanded(child: child!),
          ]);
        },
        home: FutureBuilder<void>(
          future: _ready,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const StartupScreen();
            }
            if (snapshot.hasError) {
              return StartupScreen(error: true, onRetry: _retryStartup, onContinue: _continueTemporarily);
            }
            if (!_startupReported) {
              _startupReported = true;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) recordDiagnostic('startup.route_ready');
              });
            }
            return _appState.isLoggedIn ? const AppShell() : const LandingScreen();
          },
        ),
      ),
    );
  }
}
