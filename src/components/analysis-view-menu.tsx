import { useState } from "react";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useCompactViewport } from "@/lib/runtime";
import { IconButton } from "./common";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "./ui/dropdown-menu";
export const annotationNames = {
  sections: "Sections",
  supports: "Appuis",
  loads: "Charges",
  nodes: "Nœuds",
  members: "Barres",
  reactions: "Réactions",
  dimensions: "Dimensions",
  diagrams: "Diagrammes",
  pointLoads: "Forces ponctuelles",
  distributedLoads: "Charges réparties",
  moments: "Moments",
  nodalLoads: "Charges nodales",
};
export type AnnotationKind = keyof typeof annotationNames;
export type AnnotationSettings = Record<
  AnnotationKind,
  { labels: boolean; values: boolean }
>;
export const defaultAnnotations = Object.fromEntries(
  Object.keys(annotationNames).map((k) => [
    k,
    { labels: true, values: k !== "nodes" },
  ]),
) as AnnotationSettings;
export function AnalysisViewMenu({
  kind,
  reactions,
  onReactions,
  annotations,
  onChange,
}: {
  kind: "beam" | "frame";
  reactions: boolean;
  onReactions: (v: boolean) => void;
  annotations: AnnotationSettings;
  onChange: (v: AnnotationSettings) => void;
}) {
  const compact = useCompactViewport(),
    [open, setOpen] = useState(false),
    [path, setPath] = useState<string[]>([]);
  const types: AnnotationKind[] =
    kind === "beam"
      ? ["sections", "supports", "loads", "reactions", "dimensions", "diagrams"]
      : ["nodes", "supports", "members", "loads", "reactions", "diagrams"];
  const loadTypes: AnnotationKind[] = [
    "pointLoads",
    "distributedLoads",
    ...(kind === "beam" ? (["moments"] as const) : (["nodalLoads"] as const)),
  ];
  const flags = (type: AnnotationKind) => (
    <>
      {!["dimensions", "diagrams", "reactions"].includes(type) &&
        !(type === "supports" && kind === "frame") && (
          <DropdownMenuCheckboxItem
            checked={annotations[type].labels}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(labels) =>
              onChange({
                ...annotations,
                [type]: { ...annotations[type], labels },
              })
            }
          >
            Repères
          </DropdownMenuCheckboxItem>
        )}
      <DropdownMenuCheckboxItem
        checked={annotations[type].values}
        onSelect={(e) => e.preventDefault()}
        onCheckedChange={(values) =>
          onChange({
            ...annotations,
            [type]: { ...annotations[type], values },
          })
        }
      >
        {type === "supports" ? "Déplacements imposés" : "Valeurs"}
      </DropdownMenuCheckboxItem>
    </>
  );
  const options = (type: AnnotationKind) => (
    <>
      {flags(type)}
      {type === "loads" && (
        <>
          <DropdownMenuSeparator />
          {loadTypes.map((child) => (
            <DropdownMenuSub key={child}>
              <DropdownMenuSubTrigger>
                {annotationNames[child]}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>{flags(child)}</DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </>
      )}
    </>
  );
  const navigate = (next: string[]) => {
    setPath(next);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("[data-view-menu-content]")?.focus(),
    );
  };
  const nav = (label: string, next: string[]) => (
    <DropdownMenuItem
      key={label}
      onSelect={(e) => {
        e.preventDefault();
        navigate(next);
      }}
    >
      {label}
      <ChevronRight className="ml-auto" />
    </DropdownMenuItem>
  );
  const reactionsItem = (
    <DropdownMenuCheckboxItem checked={reactions} onCheckedChange={onReactions}>
      Afficher les réactions
    </DropdownMenuCheckboxItem>
  );
  const last = path.at(-1),
    type = last as AnnotationKind;
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setPath([]);
      }}
    >
      <DropdownMenuTrigger asChild>
        <IconButton label="Options de vue">
          <Eye />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        data-view-menu-content
        className={compact ? "analysis-view-menu-compact" : undefined}
      >
        {compact ? (
          <>
            {path.length > 0 && (
              <>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    navigate(path.slice(0, -1));
                  }}
                >
                  <ChevronLeft />
                  Retour
                </DropdownMenuItem>
                <DropdownMenuLabel aria-live="polite">
                  {last === "annotations"
                    ? "Annotations"
                    : last === "reaction-display"
                      ? "Réactions"
                      : annotationNames[type]}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            {!path.length ? (
              <>
                {nav("Réactions", ["reaction-display"])}
                {nav("Annotations", ["annotations"])}
              </>
            ) : last === "reaction-display" ? (
              reactionsItem
            ) : last === "annotations" ? (
              types.map((t) => nav(annotationNames[t], [...path, t]))
            ) : (
              <>
                {flags(type)}
                {type === "loads" && (
                  <>
                    <DropdownMenuSeparator />
                    {loadTypes.map((t) =>
                      nav(annotationNames[t], [...path, t]),
                    )}
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Réactions</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>{reactionsItem}</DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Annotations</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {types.map((t) => (
                  <DropdownMenuSub key={t}>
                    <DropdownMenuSubTrigger>
                      {annotationNames[t]}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {options(t)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
