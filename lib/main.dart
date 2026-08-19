import "package:flutter/material.dart";

import "src/state/app_scope.dart";
import "src/state/app_state.dart";
import "src/theme/app_theme.dart";
import "src/ui/onboarding/landing_screen.dart";

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

  @override
  void dispose() {
    _appState.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      notifier: _appState,
      child: MaterialApp(
        title: "StructCalc",
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        home: const LandingScreen(),
      ),
    );
  }
}
