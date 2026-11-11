import 'diagnostics_stub.dart' if (dart.library.io) 'diagnostics_io.dart' as platform;

/// Best-effort local diagnostics. Never include saved projects or credentials.
void recordDiagnostic(String event, {Object? error, StackTrace? stackTrace}) {
  platform.recordDiagnostic(event, error: error, stackTrace: stackTrace);
}
