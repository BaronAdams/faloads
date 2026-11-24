import { ViewMenu, type ViewEntry } from "./view-menu";
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
  const flags = (type: AnnotationKind): ViewEntry[] => [
    ...(!["dimensions", "diagrams", "reactions"].includes(type) &&
    !(
      kind === "frame" &&
      ["supports", "pointLoads", "nodalLoads"].includes(type)
    )
      ? [
          {
            label: "Repères",
            checked: annotations[type].labels,
            toggle: (labels: boolean) =>
              onChange({
                ...annotations,
                [type]: { ...annotations[type], labels },
              }),
          },
        ]
      : []),
    {
      label: type === "supports" ? "Déplacements imposés" : "Valeurs",
      checked: annotations[type].values,
      toggle: (values) =>
        onChange({ ...annotations, [type]: { ...annotations[type], values } }),
    },
  ];
  const types: AnnotationKind[] =
    kind === "beam"
      ? ["sections", "supports", "dimensions", "diagrams"]
      : ["nodes", "supports", "members", "diagrams"];
  const loads: AnnotationKind[] = [
    "pointLoads",
    "distributedLoads",
    kind === "beam" ? "moments" : "nodalLoads",
  ];
  return (
    <ViewMenu
      entries={[
        {
          label: "Réactions",
          children: [
            {
              label: "Afficher les réactions",
              keepOpen: false,
              checked: reactions,
              toggle: onReactions,
            },
            ...flags("reactions"),
          ],
        },
        {
          label: "Annotations",
          children: [
            ...types.map((type) => ({
              label: annotationNames[type],
              children: flags(type),
            })),
            {
              label: "Charges",
              children: loads.map((type) => ({
                label: annotationNames[type],
                children: flags(type),
              })),
            },
          ],
        },
      ]}
    />
  );
}
