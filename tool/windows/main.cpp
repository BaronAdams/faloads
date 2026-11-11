// Based on Flutter's generated Windows runner (BSD-3-Clause).
// Applied after `flutter create`; do not pass engine flags as Dart arguments.
#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>
#include <windows.h>

#include <algorithm>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>
#include <utility>

#include "flutter_window.h"
#include "utils.h"

namespace {
void OpenStartupLog() {
  wchar_t base[32768] = {};
  const DWORD length = GetEnvironmentVariableW(L"LOCALAPPDATA", base, 32768);
  if (length == 0 || length >= 32768) {
    if (GetTempPathW(32768, base) == 0) return;
  }
  try {
    const auto directory = std::filesystem::path(base) / L"StructCalc" / L"Logs";
    std::filesystem::create_directories(directory);
    const auto log = directory / L"startup.log";
    if (std::filesystem::exists(log) && std::filesystem::file_size(log) > 524288) {
      const auto previous = directory / L"startup.previous.log";
      std::filesystem::remove(previous);
      std::filesystem::rename(log, previous);
    }
    FILE* stream = nullptr;
    _wfreopen_s(&stream, log.c_str(), L"a", stderr);
    _wfreopen_s(&stream, log.c_str(), L"a", stdout);
    setvbuf(stderr, nullptr, _IONBF, 0);
    setvbuf(stdout, nullptr, _IONBF, 0);
  } catch (...) {
    // Diagnostics are best effort, including on restricted Windows accounts.
  }
}

bool CheckBundle() {
  wchar_t executable[32768] = {};
  const DWORD length = GetModuleFileNameW(nullptr, executable, 32768);
  if (length == 0 || length >= 32768) return false;
  const auto base = std::filesystem::path(executable).parent_path();
  std::vector<const wchar_t*> resources = {L"data\\icudtl.dat", L"data\\flutter_assets"};
#ifdef NDEBUG
  resources.push_back(L"data\\app.so");
#endif
  for (const auto* resource : resources) {
    std::error_code error;
    if (!std::filesystem::exists(base / resource, error)) {
      std::fprintf(stderr, "native.bundle_missing\n");
      MessageBoxW(nullptr,
                  L"L'application est incomplete. Extrayez toute l'archive ZIP, "
                  L"puis conservez le dossier data et toutes les DLL a cote de structcalc.exe.",
                  L"StructCalc - fichiers manquants", MB_OK | MB_ICONERROR);
      return false;
    }
  }
  return true;
}
}  // namespace

int APIENTRY wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE prev,
                      _In_ wchar_t* command_line, _In_ int show_command) {
  if (!::AttachConsole(ATTACH_PARENT_PROCESS) && ::IsDebuggerPresent()) {
    CreateAndAttachConsole();
  }
  OpenStartupLog();
  auto arguments = GetCommandLineArguments();
  const bool compatibility =
      std::find(arguments.begin(), arguments.end(), "--compatibility") != arguments.end();
  std::fprintf(stderr, "\nnative.start flutter=3.47.9 compatibility=%s\n",
               compatibility ? "true" : "false");
  if (!CheckBundle()) return EXIT_FAILURE;

  ::CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  flutter::DartProject project(L"data");
  if (compatibility) {
    // Public embedder APIs work in release. FLUTTER_ENGINE_SWITCH_* env vars
    // are ignored by release engines; passing --enable-software-rendering to
    // the stock runner only forwards an unused argument to Dart.
    project.set_impeller_switch(flutter::ImpellerSwitch::Disabled);
    project.set_gpu_preference(flutter::GpuPreference::LowPowerPreference);
  }
  project.set_dart_entrypoint_arguments(std::move(arguments));

  FlutterWindow window(project);
  const Win32Window::Point origin(10, 10);
  const Win32Window::Size size(1280, 720);
  if (!window.Create(L"StructCalc", origin, size)) {
    std::fprintf(stderr, "native.window_failed win32_error=%lu\n", GetLastError());
    MessageBoxW(nullptr,
                L"Le moteur graphique n'a pas pu demarrer. Essayez Lancer-compatibilite.cmd. "
                L"Le journal se trouve dans %LOCALAPPDATA%\\StructCalc\\Logs\\startup.log.",
                L"StructCalc - demarrage impossible", MB_OK | MB_ICONERROR);
    ::CoUninitialize();
    return EXIT_FAILURE;
  }
  window.SetQuitOnClose(true);
  ::MSG message;
  while (::GetMessage(&message, nullptr, 0, 0) > 0) {
    ::TranslateMessage(&message);
    ::DispatchMessage(&message);
  }
  std::fprintf(stderr, "native.exit\n");
  ::CoUninitialize();
  return EXIT_SUCCESS;
}
