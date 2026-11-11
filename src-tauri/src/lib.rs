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

    pub fn start() {
        // Set before constructing the runtime or starting any application thread.
        #[cfg(target_os = "windows")]
        if std::env::args().any(|arg| arg == "--compatibility") {
            let previous =
                std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
            std::env::set_var(
                "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                format!("{previous} --disable-gpu"),
            );
        }
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
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![
                read_workspace,
                write_workspace,
                diagnostic
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
