import { ViewMenu, type ViewEntry } from "./view-menu";
import {
  buildingAnnotationNames,
  type BuildingAnnotations,
  type OrbitAxis,
} from "@/domain/building-view";
export function BuildingViewMenu({
  annotations,
  onChange,
  influence,
  onInfluence,
  allLevels,
  onAllLevels,
  orbitAxis,
  onOrbitAxis,
  is3D,
  focused,
  canFocus,
  onFocus,
  hasRoof = false,
}: {
  annotations: BuildingAnnotations;
  onChange: (v: BuildingAnnotations) => void;
  influence: boolean;
  onInfluence: (v: boolean) => void;
  allLevels: boolean;
  onAllLevels: (v: boolean) => void;
  orbitAxis: OrbitAxis;
  onOrbitAxis: (v: OrbitAxis) => void;
  is3D: boolean;
  focused: boolean;
  canFocus: boolean;
  onFocus: (v: boolean) => void;
  hasRoof?: boolean;
}) {
  const categories = Object.entries(buildingAnnotationNames).filter(
    ([key]) => key !== "roof" || (is3D && hasRoof),
  );
  const entries: ViewEntry[] = [
    ...(is3D
      ? [
          {
            label: "Annotations de l’élément sélectionné",
            checked: focused,
            disabled: !canFocus,
            toggle: onFocus,
          },
        ]
      : []),
    {
      label: "Annotations",
      children: [
        ...categories.map(([key, label]) => ({
          label,
          children: (is3D && !["slabs", "roof"].includes(key)
            ? (["values"] as const)
            : (["labels", "values"] as const)
          ).map((flag) => ({
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
        ...(is3D
          ? [
              {
                label: "Noms des niveaux",
                checked: annotations.levels,
                toggle: (levels: boolean) =>
                  onChange({ ...annotations, levels }),
              },
            ]
          : []),
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
                categories.map(([k]) => [k, { labels: true, values: true }]),
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
    ...(is3D
      ? [
          {
            label: "Tous les niveaux",
            checked: allLevels,
            toggle: onAllLevels,
          },
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
        ]
      : [
          {
            label: "Surfaces d’influence",
            checked: influence,
            toggle: onInfluence,
          },
        ]),
  ];
  return <ViewMenu entries={entries} />;
}
