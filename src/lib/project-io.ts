import { z } from "zod";
import {
  projectSchema,
  workspaceSchema,
  importJson,
  type Project,
  type Workspace,
} from "./storage";
import { beamSchema, frameSchema } from "@/domain/analysis";
import { predimSchema } from "@/pages/predim-page";
import { descentSchema } from "@/pages/descent-page";
import { buildingSchema } from "@/domain/building";
import { uid } from "./utils";
export function validateProject(p: unknown): Project {
  const project = projectSchema.parse(p);
  const schema =
    project.type === "beam"
      ? beamSchema
      : project.type === "frame"
        ? frameSchema
        : project.type === "building"
          ? buildingSchema
          : project.type === "column-load" || project.type === "wall-load"
            ? descentSchema
            : predimSchema;
  schema.parse(project.data);
  if (!Number.isFinite(Date.parse(project.updatedAt)))
    throw Error("Date du projet invalide.");
  return project;
}
export async function importProjects(
  current: Workspace,
): Promise<Partial<Workspace> | null> {
  const source = await importJson();
  if (source == null) return null;
  const wrapper = source as {
    format?: string;
    version?: number;
    project?: unknown;
    workspace?: unknown;
    projects?: unknown[];
  };
  let incoming: Project[];
  if (wrapper.format === "structcalc-project") {
    if (wrapper.version !== 1)
      throw Error("Version de projet non prise en charge.");
    incoming = [validateProject(wrapper.project)];
  } else if (wrapper.format === "structcalc-workspace" || wrapper.workspace) {
    const w = workspaceSchema.parse(wrapper.workspace);
    incoming = w.projects.map(validateProject);
  } else if (wrapper.projects) {
    const parsed = workspaceSchema.safeParse(source);
    if (!parsed.success)
      throw Error(
        "Choisissez un fichier de projet ou une sauvegarde StructCalc 0.2.",
      );
    incoming = parsed.data.projects.map(validateProject);
  } else incoming = [validateProject(source)];
  const ids = new Set(current.projects.map((p) => p.id));
  return {
    projects: [
      ...incoming.map((p) => {
        if (ids.has(p.id))
          return { ...p, id: uid(), name: `${p.name} (import)` };
        ids.add(p.id);
        return p;
      }),
      ...current.projects,
    ],
  };
}
