#[cfg(all(feature = "app", desktop))]
mod desktop_menu;
pub mod windows_launch;
pub mod workspace;

#[cfg(feature = "app")]
mod application {
    use crate::workspace::{Repository, Workspace};
    use std::sync::Mutex;
    use tauri::Manager;

    pub struct Storage(Mutex<Repository>);

    #[tauri::command]
    pub async fn read_workspace(
        state: tauri::State<'_, Storage>,
    ) -> Result<Option<Workspace>, String> {
        state
            .0
            .lock()
            .map_err(|_| "Stockage occupé".to_string())?
            .read()
    }

    #[tauri::command]
    pub async fn write_workspace(
        value: Workspace,
        state: tauri::State<'_, Storage>,
    ) -> Result<(), String> {
        state
            .0
            .lock()
            .map_err(|_| "Stockage occupé".to_string())?
            .write(&value)
    }

    #[tauri::command]
    pub fn diagnostic(event: String) {
        // Only fixed event identifiers are accepted; never log project data.
        if event.len() < 100
            && event
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
        {
            log::info!("frontend.{event}");
        }
    }

    #[tauri::command]
    pub fn desktop_window_action(
        window: tauri::WebviewWindow,
        action: String,
    ) -> Result<(), String> {
        #[cfg(desktop)]
        {
            return match action.as_str() {
                "minimize" => window.minimize(),
                "fullscreen" => window
                    .is_fullscreen()
                    .and_then(|full| window.set_fullscreen(!full)),
                "close" => window.close(),
                _ => return Err("Action de fenêtre inconnue".into()),
            }
            .map_err(|error| error.to_string());
        }
        #[cfg(mobile)]
        {
            let _ = (window, action);
            Err("Les commandes de fenêtre sont réservées au Desktop".into())
        }
    }

    #[tauri::command]
    pub fn desktop_menu_ready(app: tauri::AppHandle) -> bool {
        #[cfg(desktop)]
        {
            return crate::desktop_menu::desktop_menu_ready(app);
        }
        #[cfg(mobile)]
        {
            let _ = app;
            false
        }
    }
    #[tauri::command]
    pub fn set_menu_context(
        app: tauri::AppHandle,
        project: bool,
        editor: bool,
    ) -> Result<(), String> {
        #[cfg(desktop)]
        {
            return crate::desktop_menu::set_menu_context(app, project, editor)
                .map_err(|e| e.to_string());
        }
        #[cfg(mobile)]
        {
            let _ = (app, project, editor);
            Ok(())
        }
    }

    pub fn start() {
        tauri::Builder::default()
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .plugin(
                tauri_plugin_log::Builder::new()
                    .level(log::LevelFilter::Info)
                    .max_file_size(512_000)
                    .build(),
            )
            .setup(|app| {
                let directory = app.path().app_data_dir()?;
                app.manage(Storage(Mutex::new(Repository::new(directory))));
                log::info!("native.start");
                #[cfg(desktop)]
                crate::desktop_menu::install(app.handle())?;
                #[cfg(target_os = "windows")]
                {
                    use crate::windows_launch::WindowsLaunch;
                    let launch = WindowsLaunch::parse(
                        &std::env::args().skip(1).collect::<Vec<_>>(),
                        std::env::var("CI").as_deref() == Ok("true"),
                    )
                    .map_err(std::io::Error::other)?;
                    let config = app
                        .config()
                        .app
                        .windows
                        .iter()
                        .find(|window| window.label == "main")
                        .ok_or_else(|| std::io::Error::other("Fenêtre principale absente"))?;
                    let mut window = tauri::WebviewWindowBuilder::from_config(app, config)?;
                    if let Some(args) = launch.browser_args() {
                        // WebView2 150+ ignores environment overrides in elevated hosts.
                        window = window.additional_browser_args(&args);
                    }
                    if let Some(port) = launch.smoke_port {
                        // Different browser profiles must still share the Rust workspace.
                        window = window.data_directory(
                            std::env::temp_dir().join(format!("structcalc-smoke-{port}")),
                        );
                    }
                    window.build()?;
                    log::info!("native.window_ready");
                }
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![
                read_workspace,
                write_workspace,
                diagnostic,
                desktop_menu_ready,
                desktop_window_action,
                set_menu_context
            ])
            .run(tauri::generate_context!())
            .expect("StructCalc could not initialize the native runtime");
    }
}

#[cfg(feature = "app")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    application::start();
}
