import { useStudyGuide } from "./project-guide";
import { studyAction } from "@/lib/study-events";
import { useRef, useState, type ReactNode } from "react";
import { runtime, useCompactViewport } from "@/lib/runtime";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./ui/sheet";

/** One accessible editor: left on desktop, bottom on phones/tablets. */
export function EditorSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
  desktopSide = "left",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  desktopSide?: "left" | "right";
}) {
  const compact = useCompactViewport();
  const guide = useStudyGuide();
  const start = useRef(0);
  const moved = useRef(false);
  const [drag, setDrag] = useState(0);
  const side =
    runtime === "mobile" || (runtime === "web" && compact)
      ? "bottom"
      : desktopSide;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={`editor-sheet editor-sheet-${side} ${className}`}
        data-editor-side={side}
        style={drag ? { translate: `0 ${drag}px` } : undefined}
      >
        {side === "bottom" && (
          <button
            className="sheet-grip"
            type="button"
            aria-label="Fermer le panneau en glissant"
            onClick={(event) => {
              if (event.detail === 0 || !moved.current) onOpenChange(false);
            }}
            onPointerDown={(event) => {
              start.current = event.clientY;
              moved.current = false;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                if (Math.abs(event.clientY - start.current) > 4)
                  moved.current = true;
                setDrag(Math.max(0, event.clientY - start.current));
              }
            }}
            onPointerUp={() => {
              if (drag > 70) onOpenChange(false);
              setDrag(0);
            }}
            onPointerCancel={() => setDrag(0)}
          >
            <span className="sheet-handle" />
          </button>
        )}
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {description ??
              "Modifiez les paramètres, puis appliquez vos changements."}
          </SheetDescription>
        </SheetHeader>
        {guide.active && (
          <div className="sheet-guide-instruction" role="status">
            <p>{guide.instruction}</p>
            <button
              className="sheet-guide-skip"
              onClick={() => studyAction("guide:skip")}
            >
              Passer le guide de prise en main
            </button>
          </div>
        )}
        {children}
      </SheetContent>
    </Sheet>
  );
}
export { SheetFooter as EditorFooter };
