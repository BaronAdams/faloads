import { useMemo } from "react";
import type { Project } from "@/lib/storage";
import { projectPreview } from "@/domain/project-preview";
export function ProjectPreview({ project }: { project: Project }) {
  const src=useMemo(()=>projectPreview(project),[project.type,project.data]);
  return <img className="saved-project-preview" data-testid="project-preview" src={src} alt={`Aperçu du modèle ${project.name}`} width="96" height="64" loading="lazy" draggable={false} />;
}
