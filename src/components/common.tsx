import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { useCompactViewport } from "@/lib/runtime";
import { desktopCommand, useDesktopCommands } from "@/lib/desktop-commands";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { studyAction } from "@/lib/study-events";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTheme as useTheme } from "@/lib/theme";
import {
  ArrowLeft,
  Pencil,
  CircleHelp,
  Check,
  ChevronDown,
  Download,
  LoaderCircle,
  Save,
  TriangleAlert,
  Ellipsis,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useWorkspace } from "@/lib/workspace";
import { fmt, uid } from "@/lib/utils";
import { exportJson, type Project } from "@/lib/storage";
import { typeInfo, type ProjectType } from "@/domain/projects";
export function IconButton({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & React.ComponentProps<
  typeof Button
>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={label}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export function ProjectIcon({
  type,
  size = 64,
}: {
  type: ProjectType;
  size?: number;
}) {
  const { resolvedTheme } = useTheme();
  const t = typeInfo(type);
  return (
    <img
      className="project-icon"
      src={`/project-icons/${t.icon}-${resolvedTheme === "light" ? "light" : "dark"}.png`}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  );
}
export function Panel({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      {title && (
        <CardHeader className="panel-header">
          <div>
            <CardTitle>
              <h2>{title}</h2>
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? "content" : undefined}
    >
      <AccordionItem value="content" className="border-0">
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: (string | { value: string; label: string })[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <Label htmlFor={id} title={typeof label === "string" ? label : undefined}>
        {label}
      </Label>
      <Select
        disabled={disabled}
        value={value}
        onValueChange={(v) => {
          onChange(v);
          studyAction("input:edited");
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value,
              l = typeof o === "string" ? o : o.label;
            return (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Numeric({
  label,
  value,
  onChange,
  unit,
  min = 0,
  max = 1e9,
  step,
  disabled = false,
  labelColor,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  labelColor?: string;
}) {
  const id = useId(),
    [text, setText] = useState(String(value).replace(".", ",")),
    [invalid, setInvalid] = useState(false),
    ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setText(String(value).replace(".", ","));
      setInvalid(false);
      ref.current?.setCustomValidity("");
    }
  }, [value]);
  return (
    <div className="field">
      <Label htmlFor={id} title={typeof label === "string" ? label : undefined}>
        {labelColor && (
          <i
            className="field-swatch"
            style={{ background: labelColor }}
            aria-hidden="true"
          />
        )}
        {label}
      </Label>
      <div className="number-input">
        <Input
          ref={ref}
          id={id}
          inputMode="decimal"
          value={text}
          required
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const n = Number(t.trim().replace(",", "."));
            const valid =
              t.trim() !== "" && Number.isFinite(n) && n >= min && n <= max;
            setInvalid(!valid);
            e.target.setCustomValidity(
              valid ? "" : `Valeur attendue entre ${min} et ${max}`,
            );
            if (valid) {
              onChange(n);
              studyAction("input:edited");
            }
          }}
          step={step}
        />
        {unit && <span>{unit}</span>}
      </div>
      {invalid && (
        <span className="field-error" id={`${id}-error`}>
          Valeur attendue entre {min} et {max}.
        </span>
      )}
    </div>
  );
}
export function Metric({
  label,
  value,
  unit = "",
  tone = "",
}: {
  label: string;
  value: number | string;
  unit?: string;
  tone?: string;
}) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <div>
        <strong className={typeof value === "number" ? "mono" : ""}>
          {typeof value === "number" ? fmt(value) : value}
        </strong>
        <small>{unit}</small>
      </div>
    </div>
  );
}
export function Notice({
  children,
  danger = false,
}: {
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`notice ${danger ? "danger" : ""}`}
      role={danger ? "alert" : undefined}
    >
      <TriangleAlert size={16} />
      <div>{children}</div>
    </div>
  );
}
export function ProjectHeader({
  type,
  project,
  data,
  name,
  setName,
  extra,
  toolbar,
  tools,
  workbench = false,
}: {
  type: ProjectType;
  project?: Project;
  data: unknown;
  name: string;
  setName: (v: string) => void;
  extra?: ReactNode;
  toolbar?: ReactNode;
  tools?: ReactNode;
  workbench?: boolean;
}) {
  const location = useLocation();
  const compact = useCompactViewport();
  const extraRef = useRef<HTMLDivElement>(null);
  const initialName = location.state?.newStudyName as string | undefined;
  const nav = useNavigate(),
    { saveProject, temporary } = useWorkspace(),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [naming, setNaming] = useState(!project && !initialName),
    [created, setCreated] = useState(!!project || !!initialName),
    [nameDraft, setNameDraft] = useState(project?.name ?? "");
  useEffect(() => {
    if (!project && initialName) {
      setName(initialName);
      const frame = requestAnimationFrame(() => studyAction("name:created"));
      return () => cancelAnimationFrame(frame);
    }
  }, []);
  useEffect(() => setSaved(false), [data, name]);
  const save = async () => {
    const invalid = document.querySelector<HTMLInputElement>("input:invalid");
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    if (!name.trim()) return toast.error("Donnez un nom à votre projet.");
    setSaving(true);
    try {
      const p = {
        id: project?.id ?? uid(),
        name: name.trim(),
        type,
        updatedAt: new Date().toISOString(),
        data,
      };
      await saveProject(p);
      setSaved(true);
      studyAction("project:saved");
      toast.success("Projet enregistré sur cet appareil.");
      if (!project) nav(`/project/${p.id}`, { replace: true });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  };
  const exportStudy = () =>
    void exportJson(`${name || type}.structcalc.json`, {
      format: "structcalc-project",
      version: 1,
      project: {
        id: project?.id ?? uid(),
        name: name.trim() || typeInfo(type).label,
        type,
        updatedAt: new Date().toISOString(),
        data,
      },
    }).catch(() => toast.error("Export impossible."));
  const rename = () => {
    setNameDraft(name);
    setNaming(true);
  };
  useDesktopCommands({
    "file:save": () => void save(),
    "file:export": exportStudy,
    "file:rename": rename,
    "help:guide": () => studyAction("guide:replay"),
  });
  return (
    <header
      className={`project-header compact-project-header${workbench ? " workbench-project-header" : ""}`}
      data-testid={workbench ? "project-workbench-header" : undefined}
    >
      <Dialog
        open={naming}
        onOpenChange={(open) => {
          if (created) setNaming(open);
        }}
      >
        <DialogContent
          showCloseButton={created}
          className="name-study-dialog"
          onEscapeKeyDown={(e) => {
            if (!created) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (!created) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {created ? "Renommer l’étude" : "Comment s’appelle votre étude ?"}
            </DialogTitle>
            <DialogDescription>
              {created
                ? "Ce nom apparaîtra dans vos projets et vos exports."
                : `${typeInfo(type).label} · Donnez un nom à ce projet pour le retrouver facilement.`}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameDraft.trim()) return;
              setName(nameDraft.trim());
              setCreated(true);
              setNaming(false);
              if (!created) studyAction("name:created");
            }}
          >
            <Label htmlFor="study-name">Nom du projet</Label>
            <Input
              id="study-name"
              autoFocus
              required
              maxLength={200}
              placeholder="Ex. Résidence Horizon — plancher R+1"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
            />
            <p className="name-hint">
              Vous pourrez le renommer à tout moment en cliquant sur son nom.
            </p>
            <div className="name-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => (created ? setNaming(false) : nav("/"))}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={!nameDraft.trim()}>
                {created ? "Enregistrer le nom" : "Créer l’étude"}
                <ChevronDown className="-rotate-90" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <IconButton label="Retour aux calculs" onClick={() => nav("/")}>
        <ArrowLeft />
      </IconButton>
      <div className="project-heading">
        <button
          className="study-name-button"
          onClick={() => {
            setNameDraft(name);
            setNaming(true);
          }}
          title={name}
          aria-label={`Renommer le projet ${name}`}
        >
          <h1>{name}</h1>
          <Pencil size={13} />
        </button>
        <span className="study-type-description">{typeInfo(type).label}</span>
      </div>
      {toolbar && <div className="project-header-toolbar">{toolbar}</div>}
      <div className="project-actions">
        {tools}
        {extra && (
          <div
            ref={extraRef}
            className={`project-extra${workbench && compact ? " project-extra-in-menu" : ""}`}
          >
            {extra}
          </div>
        )}
        {workbench ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="Autres actions du projet">
                <Ellipsis />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {compact && extra && (
                <DropdownMenuItem
                  onSelect={() =>
                    extraRef.current
                      ?.querySelector<HTMLButtonElement>("button")
                      ?.click()
                  }
                >
                  {type === "building"
                    ? "Dimensions types du projet"
                    : "Calcul simplifié G/Q"}
                </DropdownMenuItem>
              )}
              {compact && ["beam", "frame"].includes(type) && (
                <DropdownMenuItem
                  onSelect={() =>
                    document
                      .querySelector<HTMLButtonElement>(
                        '.workbench-project-header [aria-label="Dimensions types du projet"]',
                      )
                      ?.click()
                  }
                >
                  Dimensions types du projet
                </DropdownMenuItem>
              )}
              {compact && (
                <DropdownMenuItem
                  onSelect={() => desktopCommand("help:shortcuts")}
                >
                  Raccourcis clavier et souris
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={rename}>
                <Pencil />
                Renommer le projet
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportStudy}>
                <Download />
                Exporter le projet
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => studyAction("guide:replay")}>
                <CircleHelp />
                Rejouer le guide
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <IconButton
              label="Rejouer le guide"
              onClick={() => studyAction("guide:replay")}
            >
              <CircleHelp />
            </IconButton>
            <IconButton
              label="Exporter le projet"
              onClick={() =>
                void exportJson(`${name || type}.structcalc.json`, {
                  format: "structcalc-project",
                  version: 1,
                  project: {
                    id: project?.id ?? uid(),
                    name: name.trim() || typeInfo(type).label,
                    type,
                    updatedAt: new Date().toISOString(),
                    data,
                  },
                }).catch(() => toast.error("Export impossible."))
              }
            >
              <Download />
            </IconButton>
          </>
        )}
        <Button
          aria-label={
            saving
              ? "Enregistrement en cours"
              : saved
                ? "Enregistré"
                : "Enregistrer"
          }
          onClick={() => void save()}
          data-tour="save"
          disabled={saving || temporary || !created}
        >
          {saving ? (
            <LoaderCircle className="animate-spin" />
          ) : saved ? (
            <Check />
          ) : (
            <Save />
          )}
          {!workbench && (
            <span className="button-text">
              {saved ? "Enregistré" : "Enregistrer"}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="form-grid">{children}</div>;
}
