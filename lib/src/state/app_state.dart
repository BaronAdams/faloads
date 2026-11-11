import "dart:convert";

import "../diagnostics/app_diagnostics.dart";

import "package:flutter/foundation.dart";
import "package:shared_preferences/shared_preferences.dart";

import "presets.dart";
import "saved_project.dart";

const _prefsPresetsKey = "structcalc.presets.v1";
const _prefsProjectsKey = "structcalc.projects.v1";
const _prefsSessionKey = "structcalc.session.v1";
const _prefsThemeModeKey = "structcalc.thememode.v1";

/// Decoupled from Flutter's own `ThemeMode` so this state layer doesn't
/// need to import material.dart — main.dart maps this to the real
/// `ThemeMode` when building `MaterialApp`.
enum AppThemeMode { light, dark, system }

/// Global, session-level app state: onboarding/paywall progress, the
/// signed-in/subscription flags that gate the "Mon compte" tab and premium
/// export features, the dimension-type presets shared by every bâtiment
/// complet visit, and the saved/resumable projects shown on the dashboard.
/// Presets and projects are persisted to disk (SharedPreferences, as JSON)
/// — [loadPersisted] restores them once at app start.
class AppState extends ChangeNotifier {
  AppState(
      {Future<SharedPreferences> Function()? preferencesLoader, this.persistenceTimeout = const Duration(seconds: 8)})
      : _preferencesLoader = preferencesLoader ?? SharedPreferences.getInstance;

  final Future<SharedPreferences> Function() _preferencesLoader;
  final Duration persistenceTimeout;
  int _loadGeneration = 0;
  bool _disposed = false;
  bool _temporarySession = false;

  bool get isTemporarySession => _temporarySession;

  /// Leave the unreadable store untouched. All writes remain disabled until
  /// the next launch; a late disk read may not replace this session's state.
  void continueWithoutPersistence() {
    _loadGeneration++;
    _temporarySession = true;
    _loaded = true;
    recordDiagnostic('startup.temporary_session');
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _loadGeneration++;
    super.dispose();
  }

  bool _hasSeenOnboarding = false;
  bool _isLoggedIn = false;
  bool _isSubscribed = false;
  AppThemeMode _themeMode = AppThemeMode.dark;

  bool get hasSeenOnboarding => _hasSeenOnboarding;
  bool get isLoggedIn => _isLoggedIn;
  bool get isSubscribed => _isSubscribed;
  AppThemeMode get themeMode => _themeMode;

  /// Reusable dimension-type presets, per element category — created once
  /// (typically from the bâtiment complet toolbar or a node/edge sheet)
  /// and available from then on, everywhere, instead of resetting every
  /// time that screen is reopened.
  final Map<PresetCategory, List<DimensionPreset>> presets = {
    for (final c in PresetCategory.values) c: <DimensionPreset>[],
  };

  /// Projects the user has actually saved. Empty by default — the
  /// dashboard must show its empty state rather than sample data.
  final List<SavedProject> recentProjects = [];

  bool _loaded = false;

  /// Restores [presets], [recentProjects], the onboarding/login session and
  /// the theme mode from disk. Call once, early (see main.dart) — safe to
  /// call more than once, a no-op after the first successful load. Startup
  /// routing (main.dart) waits on this so a returning user with
  /// [hasSeenOnboarding]/[isLoggedIn] already true never sees the
  /// onboarding sequence again — only a fresh install does.
  Future<void> loadPersisted() async {
    if (_loaded) return;
    final generation = ++_loadGeneration;
    recordDiagnostic('preferences.loading');
    try {
      final prefs = await _preferencesLoader().timeout(persistenceTimeout);
      if (_disposed || generation != _loadGeneration) return;
      // Decode into temporary collections first. An invalid store must never
      // leave a half-restored session or duplicate projects after Retry.
      final loadedPresets = {for (final c in PresetCategory.values) c: <DimensionPreset>[]};
      final loadedProjects = <SavedProject>[];
      var hasSeenOnboarding = false, isLoggedIn = false, isSubscribed = false;
      var themeMode = AppThemeMode.dark;
      final presetsJson = prefs.getString(_prefsPresetsKey);
      if (presetsJson != null) {
        final decoded = jsonDecode(presetsJson) as Map<String, dynamic>;
        for (final category in PresetCategory.values) {
          final list = decoded[category.name] as List<dynamic>?;
          if (list != null) {
            loadedPresets[category]!.addAll(
              list.map((e) => DimensionPreset.fromJson(e as Map<String, dynamic>)),
            );
          }
        }
      }
      final projectsJson = prefs.getString(_prefsProjectsKey);
      if (projectsJson != null) {
        final decoded = jsonDecode(projectsJson) as List<dynamic>;
        loadedProjects.addAll(decoded.map((e) => SavedProject.fromJson(e as Map<String, dynamic>)));
      }
      final sessionJson = prefs.getString(_prefsSessionKey);
      if (sessionJson != null) {
        final decoded = jsonDecode(sessionJson) as Map<String, dynamic>;
        hasSeenOnboarding = decoded['hasSeenOnboarding'] as bool? ?? false;
        isLoggedIn = decoded['isLoggedIn'] as bool? ?? false;
        isSubscribed = decoded['isSubscribed'] as bool? ?? false;
      }
      final themeModeName = prefs.getString(_prefsThemeModeKey);
      if (themeModeName != null) themeMode = AppThemeMode.values.byName(themeModeName);
      for (final c in PresetCategory.values) {
        presets[c]!
          ..clear()
          ..addAll(loadedPresets[c]!);
      }
      recentProjects
        ..clear()
        ..addAll(loadedProjects);
      _hasSeenOnboarding = hasSeenOnboarding;
      _isLoggedIn = isLoggedIn;
      _isSubscribed = isSubscribed;
      _themeMode = themeMode;
      _loaded = true;
      recordDiagnostic('preferences.loaded');
      notifyListeners();
    } catch (error, stack) {
      recordDiagnostic('preferences.failed', error: error, stackTrace: stack);
      rethrow;
    }
  }

  Future<void> _write(String key, String value) async {
    if (_temporarySession || _disposed) return;
    try {
      final prefs = await _preferencesLoader().timeout(persistenceTimeout);
      if (_temporarySession || _disposed) return;
      final saved = await prefs.setString(key, value).timeout(persistenceTimeout);
      if (!saved) throw StateError('Preference write rejected');
    } catch (error, stack) {
      recordDiagnostic('preferences.write_failed', error: error, stackTrace: stack);
    }
  }

  Future<void> _persistPresets() => _write(
      _prefsPresetsKey,
      jsonEncode({
        for (final c in PresetCategory.values) c.name: presets[c]!.map((p) => p.toJson()).toList(),
      }));

  Future<void> _persistProjects() =>
      _write(_prefsProjectsKey, jsonEncode(recentProjects.map((p) => p.toJson()).toList()));

  Future<void> _persistSession() => _write(
      _prefsSessionKey,
      jsonEncode({
        'hasSeenOnboarding': _hasSeenOnboarding,
        'isLoggedIn': _isLoggedIn,
        'isSubscribed': _isSubscribed,
      }));

  void addPreset(PresetCategory category, DimensionPreset preset) {
    presets[category]!.add(preset);
    notifyListeners();
    _persistPresets();
  }

  void removePreset(PresetCategory category, DimensionPreset preset) {
    presets[category]!.remove(preset);
    notifyListeners();
    _persistPresets();
  }

  /// Saves (or, if a project with [id] already exists, overwrites) one
  /// resumable project. [data] is a JSON-compatible blob only the owning
  /// flow screen interprets.
  void saveProject({
    required String id,
    required SavedProjectType type,
    required String name,
    required Map<String, dynamic> data,
  }) {
    recentProjects.removeWhere((p) => p.id == id);
    recentProjects.insert(0, SavedProject(id: id, type: type, name: name, savedAt: DateTime.now(), data: data));
    notifyListeners();
    _persistProjects();
  }

  void deleteProject(String id) {
    recentProjects.removeWhere((p) => p.id == id);
    notifyListeners();
    _persistProjects();
  }

  void completeOnboarding() {
    _hasSeenOnboarding = true;
    notifyListeners();
    _persistSession();
  }

  void startFreeTrial() {
    _isSubscribed = true;
    _isLoggedIn = true;
    notifyListeners();
    _persistSession();
  }

  void continueWithoutSubscription() {
    _isLoggedIn = true;
    notifyListeners();
    _persistSession();
  }

  void logIn() {
    _isLoggedIn = true;
    notifyListeners();
    _persistSession();
  }

  void logOut() {
    _isLoggedIn = false;
    _isSubscribed = false;
    notifyListeners();
    _persistSession();
  }

  void setThemeMode(AppThemeMode mode) {
    _themeMode = mode;
    notifyListeners();
    _write(_prefsThemeModeKey, mode.name);
  }
}
