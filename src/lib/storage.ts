import { invoke, isTauri } from "@tauri-apps/api/core";
import { z } from "zod";
import { projectTypes, type ProjectType } from "@/domain/projects";
import { downloadFile } from "./utils";
const projectKinds = projectTypes.map((p) => p.id) as [
  ProjectType,
  ...ProjectType[],
];
export const projectSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  type: z.enum(projectKinds),
  updatedAt: z
    .string()
    .refine((v) => Number.isFinite(Date.parse(v)), "Date de projet invalide"),
  data: z.unknown(),
});
export type Project = z.infer<typeof projectSchema>;
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    theme: z.enum(["dark", "light", "system"]),
    onboarding: z.boolean(),
    profile: z.object({
      name: z.string().max(200),
      profession: z.string().max(200),
    }),
    preferences: z.object({
      code: z.enum(["ec2", "bael91"]),
      concrete: z.enum(["C20/25", "C25/30", "C30/37", "C35/45"]),
      quasi: z.boolean(),
    }),
    guides: z
      .record(
        z.string(),
        z.object({
          step: z.number().int().nonnegative(),
          completed: z.boolean(),
        }),
      )
      .default({}),
    projects: z.array(projectSchema).max(5000),
    presets: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        a: z.number().positive(),
        b: z.number().positive().optional(),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.projects.map((p) => p.id)).size !== v.projects.length)
      ctx.addIssue({
        code: "custom",
        message: "Identifiants de projets dupliqués",
      });
  });
export type Workspace = z.infer<typeof workspaceSchema>;
export const freshWorkspace = (): Workspace => ({
  version: 1,
  theme: "dark",
  onboarding: false,
  profile: { name: "", profession: "Ingénieur structure" },
  preferences: { code: "ec2", concrete: "C25/30", quasi: false },
  guides: {},
  projects: [],
  presets: [],
});
export const STORAGE_KEY = "structcalc.workspace.v1";
export async function readWorkspace(): Promise<Workspace> {
  const value = isTauri()
    ? await invoke<unknown>("read_workspace")
    : JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  return value == null ? freshWorkspace() : workspaceSchema.parse(value);
}
export async function writeWorkspace(value: Workspace) {
  const clean = workspaceSchema.parse(value);
  if (isTauri()) await invoke("write_workspace", { value: clean });
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
}
export async function exportJson(name: string, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  if (isTauri()) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await save({
      defaultPath: name,
      filters: [{ name: "StructCalc JSON", extensions: ["json"] }],
    });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  downloadFile(name, text);
  return true;
}
export async function importJson(): Promise<unknown | null> {
  if (isTauri()) {
    const [{ open }, { readTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await open({
      multiple: false,
      filters: [{ name: "StructCalc JSON", extensions: ["json"] }],
    });
    if (!path) return null;
    const text = await readTextFile(path);
    if (text.length > 16 * 1024 * 1024) throw Error("Fichier trop volumineux");
    return JSON.parse(text);
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (file.size > 16 * 1024 * 1024)
          throw Error("Fichier trop volumineux");
        resolve(JSON.parse(await file.text()));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
export function diagnostic(event: string) {
  if (isTauri()) void invoke("diagnostic", { event }).catch(() => {});
}
