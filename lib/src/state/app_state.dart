import "package:flutter/foundation.dart";

/// Global, session-level app state: onboarding/paywall progress and the
/// signed-in/subscription flags that gate the "Mon compte" tab and premium
/// export features. Kept intentionally small — each calculation flow owns
/// its own step state locally (see phase 4-6).
class AppState extends ChangeNotifier {
  bool _hasSeenOnboarding = false;
  bool _isLoggedIn = false;
  bool _isSubscribed = false;

  bool get hasSeenOnboarding => _hasSeenOnboarding;
  bool get isLoggedIn => _isLoggedIn;
  bool get isSubscribed => _isSubscribed;

  /// Projects the user has actually created. Empty by default — the
  /// dashboard must show its empty state rather than sample data.
  final List<String> recentProjects = [];

  void completeOnboarding() {
    _hasSeenOnboarding = true;
    notifyListeners();
  }

  void startFreeTrial() {
    _isSubscribed = true;
    _isLoggedIn = true;
    notifyListeners();
  }

  void continueWithoutSubscription() {
    _isLoggedIn = true;
    notifyListeners();
  }

  void logIn() {
    _isLoggedIn = true;
    notifyListeners();
  }

  void logOut() {
    _isLoggedIn = false;
    _isSubscribed = false;
    notifyListeners();
  }
}
