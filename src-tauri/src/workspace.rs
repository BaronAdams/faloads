use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashSet,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::PathBuf,
};

const LIMIT: u64 = 16 * 1024 * 1024;
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub version: u32,
    pub theme: String,
    pub onboarding: bool,
    pub profile: Value,
    pub preferences: Value,
    pub projects: Vec<Project>,
    pub presets: Vec<Value>,
    #[serde(default)]
    pub guides: std::collections::HashMap<String, GuideProgress>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuideProgress {
    pub step: usize,
    pub completed: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub updated_at: String,
    pub data: Value,
}
impl Workspace {
    fn validate(&self) -> Result<(), String> {
        if self.version != 1 {
            return Err("Version de sauvegarde non prise en charge".into());
        }
        if !["dark", "light", "system"].contains(&self.theme.as_str()) {
            return Err("Thème invalide".into());
        }
        if self.projects.len() > 5000 {
            return Err("Trop de projets dans cette sauvegarde".into());
        }
        let mut ids = HashSet::new();
        for project in &self.projects {
            if project.id.is_empty()
                || project.id.len() > 100
                || project.name.is_empty()
                || project.name.len() > 200
                || !ids.insert(&project.id)
                || ![
                    "beam",
                    "frame",
                    "column-load",
                    "wall-load",
                    "building",
                    "column",
                    "beam-size",
                    "wall",
                    "stairs",
                    "balcony",
                    "slab",
                    "retaining",
                    "footing",
                ]
                .contains(&project.kind.as_str())
            {
                return Err("Projet invalide dans la sauvegarde".into());
            }
        }
        Ok(())
    }
}

pub struct Repository {
    directory: PathBuf,
}
impl Repository {
    pub fn new(directory: PathBuf) -> Self {
        Self { directory }
    }
    pub fn read(&self) -> Result<Option<Workspace>, String> {
        let path = self.directory.join("workspace.json");
        if !path.exists() {
            return Ok(None);
        }
        let mut contents = String::new();
        File::open(path)
            .map_err(|_| "Lecture des données locales impossible")?
            .take(LIMIT + 1)
            .read_to_string(&mut contents)
            .map_err(|_| "Lecture des données locales impossible")?;
        if contents.len() as u64 > LIMIT {
            return Err("Sauvegarde trop volumineuse".into());
        }
        let workspace: Workspace = serde_json::from_str(&contents)
            .map_err(|_| "Données locales invalides ; le fichier original est conservé")?;
        workspace.validate()?;
        Ok(Some(workspace))
    }
    pub fn write(&self, value: &Workspace) -> Result<(), String> {
        value.validate()?;
        let data = serde_json::to_vec_pretty(value).map_err(|_| "Données non sérialisables")?;
        if data.len() as u64 > LIMIT {
            return Err("Sauvegarde trop volumineuse".into());
        }
        // Refuse to overwrite an unreadable original. Recovery is an explicit
        // user action in the UI, with a temporary session that disables writes.
        self.read()?;
        fs::create_dir_all(&self.directory).map_err(|_| "Dossier de sauvegarde inaccessible")?;
        let target = self.directory.join("workspace.json");
        let temporary = self.directory.join("workspace.pending.json");
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&temporary)
            .map_err(|_| "Création de la sauvegarde impossible")?;
        file.write_all(&data)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Écriture de la sauvegarde impossible")?;
        drop(file);
        if target.exists() {
            fs::copy(&target, self.directory.join("workspace.previous.json"))
                .map_err(|_| "Copie de secours impossible")?;
        }
        fs::rename(temporary, target).map_err(|_| "Validation de la sauvegarde impossible")?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn value() -> Workspace {
        serde_json::from_value(serde_json::json!({"version":1,"theme":"dark","onboarding":true,"profile":{},"preferences":{},"projects":[],"presets":[]})).unwrap()
    }
    #[test]
    fn fresh_install_has_no_document() {
        let d = tempfile::tempdir().unwrap();
        assert!(Repository::new(d.path().into()).read().unwrap().is_none());
    }
    #[test]
    fn survives_reopening_and_retains_previous_copy() {
        let d = tempfile::tempdir().unwrap();
        let repo = Repository::new(d.path().into());
        let mut w = value();
        repo.write(&w).unwrap();
        w.theme = "light".into();
        repo.write(&w).unwrap();
        assert_eq!(
            Repository::new(d.path().into())
                .read()
                .unwrap()
                .unwrap()
                .theme,
            "light"
        );
        let previous: Workspace =
            serde_json::from_slice(&fs::read(d.path().join("workspace.previous.json")).unwrap())
                .unwrap();
        assert_eq!(previous.theme, "dark");
    }
    #[test]
    fn old_workspaces_load_and_per_type_guides_survive_native_storage() {
        let d = tempfile::tempdir().unwrap();
        let repo = Repository::new(d.path().into());
        let mut w = value();
        assert!(w.guides.is_empty());
        w.guides.insert(
            "beam".into(),
            GuideProgress {
                step: 8,
                completed: true,
            },
        );
        w.guides.insert(
            "frame".into(),
            GuideProgress {
                step: 2,
                completed: false,
            },
        );
        repo.write(&w).unwrap();
        let restored = repo.read().unwrap().unwrap();
        assert!(restored.guides["beam"].completed);
        assert!(!restored.guides["frame"].completed);
        assert_eq!(restored.guides["frame"].step, 2);
    }
    #[test]
    fn malformed_file_is_never_overwritten() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("workspace.json");
        fs::write(&p, b"broken").unwrap();
        let r = Repository::new(d.path().into());
        assert!(r.read().is_err());
        assert!(r.write(&value()).is_err());
        assert_eq!(fs::read(p).unwrap(), b"broken");
    }
    #[test]
    fn unsupported_version_is_preserved() {
        let d = tempfile::tempdir().unwrap();
        let mut w = value();
        w.version = 2;
        assert!(Repository::new(d.path().into()).write(&w).is_err());
    }
    #[test]
    fn duplicate_project_ids_are_rejected() {
        let mut w = value();
        let p = Project {
            id: "same".into(),
            name: "Test".into(),
            kind: "beam".into(),
            updated_at: "2026-11-11".into(),
            data: Value::Null,
        };
        w.projects = vec![p.clone(), p];
        assert!(w.validate().is_err());
    }
}
