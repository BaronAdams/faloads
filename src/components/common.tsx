import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAppTheme as useTheme } from "@/lib/theme";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  LoaderCircle,
  Save,
  TriangleAlert,
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
}: {
  label: string;
  value: string;
  options: (string | { value: string; label: string })[];
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
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
      <Label htmlFor={id}>{label}</Label>
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
            if (valid) onChange(n);
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
}: {
  type: ProjectType;
  project?: Project;
  data: unknown;
  name: string;
  setName: (v: string) => void;
  extra?: ReactNode;
}) {
  const nav = useNavigate(),
    { saveProject, temporary } = useWorkspace(),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
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
  return (
    <header className="project-header">
      <IconButton label="Retour aux calculs" onClick={() => nav("/")}>
        <ArrowLeft />
      </IconButton>
      <div className="project-heading">
        <span className="eyebrow">{typeInfo(type).family}</span>
        <h1>{typeInfo(type).label}</h1>
      </div>
      <div className="project-actions">
        {extra}
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
        <Button
          aria-label={
            saving
              ? "Enregistrement en cours"
              : saved
                ? "Enregistré"
                : "Enregistrer"
          }
          onClick={() => void save()}
          disabled={saving || temporary}
        >
          {saving ? (
            <LoaderCircle className="animate-spin" />
          ) : saved ? (
            <Check />
          ) : (
            <Save />
          )}
          <span className="button-text">
            {saved ? "Enregistré" : "Enregistrer"}
          </span>
        </Button>
      </div>
      <div className="project-name">
        <Label htmlFor="project-name">Nom du projet</Label>
        <Input
          id="project-name"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <span className="status-dot" />
        {saved ? "Sauvegardé" : "Brouillon"}
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
