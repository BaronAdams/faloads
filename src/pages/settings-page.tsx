import { useState } from "react";
import {
  Download,
  Upload,
  Monitor,
  Sun,
  Moon,
  FolderArchive,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Panel, Choice, FormGrid, Notice } from "@/components/common";
import { useWorkspace } from "@/lib/workspace";
import { useAppTheme } from "@/lib/theme";
import { exportJson, importJson, workspaceSchema } from "@/lib/storage";
import { concreteClasses } from "@/domain/engineering";
import { fmt } from "@/lib/utils";
export function SettingsPage({ profile = false }: { profile?: boolean }) {
  const { workspace, update, temporary } = useWorkspace(),
    { resolvedTheme } = useAppTheme(),
    [pending, setPending] = useState<unknown | null>(null);
  const change = (next: Parameters<typeof update>[0]) =>
    void update(next).catch(() =>
      toast.error("Les modifications ne sont pas sauvegardées."),
    );
  if (profile)
    return (
      <div className="page-content">
        <header className="page-title">
          <div>
            <span className="eyebrow">VOTRE ESPACE PERSONNEL</span>
            <h1>Mon profil</h1>
            <p>Les informations de cet espace restent sur cet appareil.</p>
          </div>
        </header>
        <div className="two-columns">
          <Panel title="Votre profil">
            <div className="form-stack">
              <div className="field">
                <Label htmlFor="profile-name">Nom ou agence</Label>
                <Input
                  id="profile-name"
                  maxLength={100}
                  value={workspace.profile.name}
                  placeholder="Votre nom"
                  onChange={(e) =>
                    change({
                      profile: { ...workspace.profile, name: e.target.value },
                    })
                  }
                />
              </div>
              <div className="field">
                <Label htmlFor="profession">Profession</Label>
                <Input
                  id="profession"
                  value={workspace.profile.profession}
                  onChange={(e) =>
                    change({
                      profile: {
                        ...workspace.profile,
                        profession: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
          </Panel>
          <Panel title="Un espace local">
            <div className="profile-mark">
              {workspace.profile.name.slice(0, 1).toUpperCase() || "σ"}
            </div>
            <h2>{workspace.profile.name || "Votre espace StructCalc"}</h2>
            <p className="muted mt-3">
              {workspace.projects.length} projet
              {workspace.projects.length > 1 ? "s" : ""} enregistré
              {workspace.projects.length > 1 ? "s" : ""}
            </p>
            <Notice>
              La version actuelle ne comprend pas de connexion à un compte
              distant, de paiement ou de synchronisation cloud. Exportez une
              sauvegarde pour déplacer vos études vers un autre appareil.
            </Notice>
          </Panel>
        </div>
      </div>
    );
  return (
    <div className="page-content">
      <header className="page-title">
        <div>
          <span className="eyebrow">À VOTRE MESURE</span>
          <h1>Paramètres</h1>
          <p>Vos préférences de calcul et vos sections réutilisables.</p>
        </div>
      </header>
      <div className="settings-grid">
        <Panel
          title="Apparence"
          description="Le thème s’applique aux plans et aux diagrammes."
        >
          <div className="theme-choices">
            {(
              [
                { id: "light", label: "Clair", Icon: Sun },
                { id: "dark", label: "Sombre", Icon: Moon },
                { id: "system", label: "Système", Icon: Monitor },
              ] as const
            ).map(({ id, label, Icon }) => (
              <Button
                key={id}
                variant={workspace.theme === id ? "secondary" : "outline"}
                aria-pressed={workspace.theme === id}
                onClick={() => change({ theme: id })}
              >
                <Icon />
                {label}
              </Button>
            ))}
          </div>
          <p className="hint">
            Textes : DM Sans · Valeurs et dimensions : JetBrains Mono.
          </p>
        </Panel>
        <Panel
          title="Valeurs par défaut"
          description="Ces choix s’appliquent aux nouveaux projets."
        >
          <div className="form-stack">
            <Choice
              label="Règlement"
              value={workspace.preferences.code}
              options={[
                { value: "ec2", label: "Eurocode 2" },
                { value: "bael91", label: "BAEL 91" },
              ]}
              onChange={(code) =>
                change({
                  preferences: {
                    ...workspace.preferences,
                    code: code as "ec2" | "bael91",
                  },
                })
              }
            />
            <Choice
              label="Classe de béton"
              value={workspace.preferences.concrete}
              options={concreteClasses}
              onChange={(concrete) =>
                change({
                  preferences: {
                    ...workspace.preferences,
                    concrete: concrete as typeof workspace.preferences.concrete,
                  },
                })
              }
            />
            <Label className="toggle">
              <Switch
                checked={workspace.preferences.quasi}
                onCheckedChange={(quasi) =>
                  change({ preferences: { ...workspace.preferences, quasi } })
                }
              />
              ELS quasi permanent par défaut
            </Label>
          </div>
        </Panel>
        <Panel
          title="Dimensions types par projet"
          description="Ouvrez une étude, puis Dimensions types du projet pour définir ses sections."
        >
          <p className="hint">
            Chaque étude conserve sa propre bibliothèque. Modifier une section
            type ne change aucun autre projet.
          </p>
          {workspace.presets.length > 0 && (
            <details>
              <summary>Anciens préréglages conservés en archive</summary>
              {workspace.presets.map((p) => (
                <p key={p.id}>
                  {p.name} · {fmt(p.a)}
                  {p.b ? ` × ${fmt(p.b)}` : ""} cm
                </p>
              ))}
            </details>
          )}
        </Panel>
        <Panel
          title="Sauvegarde et transfert"
          description="Une copie JSON contient vos projets, préférences et préréglages."
        >
          <div className="form-stack">
            <Button
              variant="outline"
              onClick={() =>
                void exportJson("StructCalc-sauvegarde.json", {
                  format: "structcalc-workspace",
                  version: 1,
                  workspace,
                })
                  .then((done) => done && toast.success("Sauvegarde exportée."))
                  .catch(() => toast.error("Export impossible."))
              }
            >
              <Download />
              Exporter mon espace
            </Button>
            <Button
              variant="outline"
              disabled={temporary}
              onClick={() =>
                void importJson()
                  .then((value) => {
                    if (!value) return;
                    const wrapper = value as { workspace?: unknown };
                    const parsed = workspaceSchema.parse(
                      wrapper.workspace ?? value,
                    );
                    setPending(parsed);
                  })
                  .catch(() =>
                    toast.error(
                      "Ce fichier ne contient pas une sauvegarde StructCalc valide.",
                    ),
                  )
              }
            >
              <Upload />
              Restaurer une sauvegarde
            </Button>
            <Notice>
              La restauration remplace l’espace actuel après votre validation.
              Exportez-le d’abord pour en conserver une copie.
            </Notice>
          </div>
        </Panel>
      </div>
      <div className="about-card">
        <span className="brand-mark small">σ</span>
        <div>
          <strong>
            StructCalc <span className="mono">0.2.0</span>
          </strong>
          <p>
            Calcul de structures et descente de charges · Interface en français
            · Données locales.
          </p>
        </div>
      </div>
      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurer cet espace ?</DialogTitle>
            <DialogDescription>
              Les projets et réglages présents sur cet appareil seront remplacés
              par ceux de la sauvegarde choisie.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button
              onClick={() =>
                void update(workspaceSchema.parse(pending))
                  .then(() => {
                    setPending(null);
                    toast.success("Espace restauré.");
                  })
                  .catch(() => toast.error("Restauration impossible."))
              }
            >
              Restaurer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
