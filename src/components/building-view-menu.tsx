import { useState } from "react";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./common";
import { useCompactViewport } from "@/lib/runtime";
import {
  buildingAnnotationNames,
  type BuildingAnnotations,
  type OrbitAxis,
} from "@/domain/building-view";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./ui/dropdown-menu";
type Entry = {
  label: string;
  children?: Entry[];
  checked?: boolean;
  toggle?: (value: boolean) => void;
  action?: () => void;
};
export function BuildingViewMenu({
  annotations,
  onChange,
  influence,
  onInfluence,
  allLevels,
  onAllLevels,
  orbitAxis,
  onOrbitAxis,
}: {
  annotations: BuildingAnnotations;
  onChange: (v: BuildingAnnotations) => void;
  influence: boolean;
  onInfluence: (v: boolean) => void;
  allLevels: boolean;
  onAllLevels: (v: boolean) => void;
  orbitAxis: OrbitAxis;
  onOrbitAxis: (v: OrbitAxis) => void;
}) {
  const compact = useCompactViewport(),
    [path, setPath] = useState<number[]>([]);
  const nodes: Entry[] = [
    {
      label: "Annotations",
      children: [
        ...Object.entries(buildingAnnotationNames).map(([key, label]) => ({
          label,
          children: (["labels", "values"] as const).map((flag) => ({
            label: flag === "labels" ? "Repères" : "Valeurs",
            checked:
              annotations[key as keyof typeof buildingAnnotationNames][flag],
            toggle: (value: boolean) =>
              onChange({
                ...annotations,
                [key]: {
                  ...annotations[key as keyof typeof buildingAnnotationNames],
                  [flag]: value,
                },
              }),
          })),
        })),
        {
          label: "Noms des niveaux",
          checked: annotations.levels,
          toggle: (levels) => onChange({ ...annotations, levels }),
        },
        {
          label: "Axes de la grille",
          checked: annotations.axes,
          toggle: (axes) => onChange({ ...annotations, axes }),
        },
        {
          label: "Tous les éléments",
          action: () =>
            onChange({
              ...annotations,
              ...Object.fromEntries(
                Object.keys(buildingAnnotationNames).map((k) => [
                  k,
                  { labels: true, values: true },
                ]),
              ),
            }),
        },
        {
          label: "Masquer les annotations",
          action: () =>
            onChange({
              ...annotations,
              ...Object.fromEntries(
                Object.keys(buildingAnnotationNames).map((k) => [
                  k,
                  { labels: false, values: false },
                ]),
              ),
              levels: false,
              axes: false,
            }),
        },
      ],
    },
    { label: "Tous les niveaux", checked: allLevels, toggle: onAllLevels },
    { label: "Surfaces d’influence", checked: influence, toggle: onInfluence },
    {
      label: "Rotation 3D",
      children: (
        [
          ["auto", "Selon le geste"],
          ["vertical", "Axe vertical"],
          ["horizontal", "Axe horizontal"],
        ] as const
      ).map(([value, label]) => ({
        label,
        checked: orbitAxis === value,
        toggle: () => onOrbitAxis(value),
      })),
    },
  ];
  const entries = (items: Entry[], prefix: number[] = []): React.ReactNode =>
    items.map((entry, index) =>
      entry.children ? (
        compact ? (
          <DropdownMenuItem
            key={entry.label}
            onSelect={(e) => {
              e.preventDefault();
              setPath([...prefix, index]);
            }}
          >
            {entry.label}
            <ChevronRight className="ml-auto" />
          </DropdownMenuItem>
        ) : (
          <DropdownMenuSub key={entry.label}>
            <DropdownMenuSubTrigger>{entry.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {entries(entry.children, [...prefix, index])}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )
      ) : entry.toggle ? (
        <DropdownMenuCheckboxItem
          key={entry.label}
          checked={entry.checked}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={entry.toggle}
        >
          {entry.label}
        </DropdownMenuCheckboxItem>
      ) : (
        <DropdownMenuItem key={entry.label} onSelect={entry.action}>
          {entry.label}
        </DropdownMenuItem>
      ),
    );
  let current = nodes,
    title = "Vue";
  for (const index of path) {
    title = current[index].label;
    current = current[index].children!;
  }
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setPath([]);
      }}
    >
      <DropdownMenuTrigger asChild>
        <IconButton label="Options de vue">
          <Eye />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={compact ? "analysis-view-menu-compact" : undefined}
      >
        {compact && path.length > 0 && (
          <>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setPath(path.slice(0, -1));
              }}
            >
              <ChevronLeft />
              Retour
            </DropdownMenuItem>
            <DropdownMenuLabel>{title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {entries(current, path)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
