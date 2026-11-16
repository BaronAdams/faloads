use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Wry,
};

fn item(
    app: &AppHandle,
    id: &str,
    text: &str,
    shortcut: Option<&str>,
) -> tauri::Result<MenuItem<Wry>> {
    MenuItem::with_id(app, id, text, true, shortcut)
}

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let menu = Menu::new(app)?;
    #[cfg(target_os = "macos")]
    menu.append(&Submenu::with_items(
        app,
        "StructCalc",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("À propos de StructCalc"), None)?,
            &item(app, "app:settings", "Réglages…", Some("Cmd+,"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, Some("Services"))?,
            &PredefinedMenuItem::hide(app, Some("Masquer StructCalc"))?,
            &PredefinedMenuItem::hide_others(app, Some("Masquer les autres"))?,
            &PredefinedMenuItem::show_all(app, Some("Tout afficher"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("Quitter StructCalc"))?,
        ],
    )?)?;
    let file = Submenu::with_items(
        app,
        "&Fichier",
        true,
        &[
            &item(
                app,
                "file:new",
                "Nouveau projet…",
                Some("CmdOrCtrl+Shift+N"),
            )?,
            &item(app, "file:open", "Ouvrir un projet…", Some("CmdOrCtrl+O"))?,
            &item(app, "file:import", "Importer…", None)?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "file:save", "Enregistrer", Some("CmdOrCtrl+S"))?,
            &item(
                app,
                "file:export",
                "Exporter le projet…",
                Some("CmdOrCtrl+Shift+S"),
            )?,
            &item(app, "file:rename", "Renommer…", None)?,
        ],
    )?;
    #[cfg(not(target_os = "macos"))]
    {
        file.append(&PredefinedMenuItem::separator(app)?)?;
        file.append(&item(app, "app:settings", "Paramètres…", None)?)?;
        file.append(&PredefinedMenuItem::quit(app, Some("Quitter"))?)?;
    }
    menu.append(&file)?;
    // Editing shortcuts stay in the WebView so text fields keep their native editing behavior.
    menu.append(&Submenu::with_items(
        app,
        "&Édition",
        true,
        &[
            &item(app, "edit:undo", "Annuler", None)?,
            &item(app, "edit:redo", "Rétablir", None)?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "edit:copy", "Copier les propriétés", None)?,
            &item(app, "edit:paste", "Coller les propriétés", None)?,
            &item(
                app,
                "edit:select-all",
                "Tout sélectionner de même nature",
                None,
            )?,
            &item(app, "edit:delete", "Supprimer la sélection", None)?,
            &item(app, "edit:add", "Ajouter un élément…", None)?,
        ],
    )?)?;
    menu.append(&Submenu::with_items(
        app,
        "&Affichage",
        true,
        &[
            &item(app, "view:zoom-in", "Agrandir", None)?,
            &item(app, "view:zoom-out", "Réduire", None)?,
            &item(app, "view:reset", "Recentrer", None)?,
            &PredefinedMenuItem::separator(app)?,
            &item(app, "view:parameters", "Paramètres du projet…", None)?,
            &item(app, "view:results", "Résultats…", None)?,
        ],
    )?)?;
    menu.append(&Submenu::with_items(
        app,
        "&Calcul",
        true,
        &[&item(
            app,
            "study:calculate",
            "Lancer le calcul",
            Some("F5"),
        )?],
    )?)?;
    let window = Submenu::with_items(
        app,
        "&Fenêtre",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("Réduire la fenêtre"))?,
            &PredefinedMenuItem::fullscreen(app, Some("Plein écran"))?,
            &PredefinedMenuItem::close_window(app, Some("Fermer la fenêtre"))?,
        ],
    )?;
    menu.append(&window)?;
    let help = Submenu::with_items(
        app,
        "&Aide",
        true,
        &[
            &item(app, "help:guide", "Guide de prise en main", None)?,
            &item(app, "help:shortcuts", "Raccourcis clavier…", None)?,
        ],
    )?;
    #[cfg(not(target_os = "macos"))]
    help.append(&PredefinedMenuItem::about(
        app,
        Some("À propos de StructCalc"),
        None,
    )?)?;
    menu.append(&help)?;
    app.set_menu(menu)?;
    #[cfg(target_os = "macos")]
    {
        window.set_as_windows_menu_for_nsapp()?;
        help.set_as_help_menu_for_nsapp()?;
    }
    set_menu_context(app.clone(), false, false)?;
    app.on_menu_event(|app, event| {
        let _ = app.emit("desktop-menu", event.id().as_ref());
    });
    Ok(())
}

pub fn desktop_menu_ready(app: AppHandle) -> bool {
    app.menu().is_some()
}

pub fn set_menu_context(app: AppHandle, project: bool, editor: bool) -> tauri::Result<()> {
    if let Some(menu) = app.menu() {
        for id in [
            "file:save",
            "file:export",
            "file:rename",
            "edit:undo",
            "edit:redo",
            "edit:copy",
            "edit:paste",
            "edit:select-all",
            "edit:delete",
            "edit:add",
            "view:zoom-in",
            "view:zoom-out",
            "view:reset",
            "view:parameters",
            "view:results",
            "study:calculate",
            "help:guide",
            "help:shortcuts",
        ] {
            for entry in menu.items()? {
                if let Some(submenu) = entry.as_submenu() {
                    if let Some(item) = submenu.get(id).and_then(|item| item.as_menuitem().cloned())
                    {
                        let editor_only = id.starts_with("edit:")
                            || id.starts_with("view:")
                            || id.starts_with("study:")
                            || id == "help:shortcuts";
                        item.set_enabled(project && (!editor_only || editor))?;
                    }
                }
            }
        }
    }
    Ok(())
}
