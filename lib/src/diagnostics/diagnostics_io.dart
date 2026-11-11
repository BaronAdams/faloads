import 'dart:io';

void recordDiagnostic(String event, {Object? error, StackTrace? stackTrace}) {
  if (!Platform.isWindows) return;
  try {
    final base = Platform.environment['LOCALAPPDATA'] ?? Directory.systemTemp.path;
    final directory = Directory('$base/StructCalc/Logs')..createSync(recursive: true);
    // Match the native runner's append-only log. Rotation happens before the
    // engine opens it. Log the type, not an exception's possibly private data.
    File('${directory.path}/startup.log').writeAsStringSync(
      '${DateTime.now().toIso8601String()} dart.$event'
      '${error == null ? '' : ' error=${error.runtimeType}'}\n'
      '${stackTrace == null ? '' : '$stackTrace\n'}',
      mode: FileMode.append,
      flush: true,
    );
  } catch (_) {
    // A diagnostic must never become another reason the application won't open.
  }
}
