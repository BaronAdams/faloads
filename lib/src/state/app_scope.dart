import "package:flutter/widgets.dart";

import "app_state.dart";

/// Makes the single [AppState] instance available to the whole tree without
/// pulling in a state-management package. Widgets read it with
/// `AppScope.of(context)` and rebuild automatically when it changes.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState super.notifier, required super.child});

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, "No AppScope found in context");
    return scope!.notifier!;
  }
}
