import { useState } from "react";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useCompactViewport } from "@/lib/runtime";
import { IconButton } from "./common";
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
export type ViewEntry = {
  label: string;
  children?: ViewEntry[];
  checked?: boolean;
  toggle?: (v: boolean) => void;
  action?: () => void;
  disabled?: boolean;
  keepOpen?: boolean;
};
export function ViewMenu({ entries }: { entries: ViewEntry[] }) {
  const compact = useCompactViewport(),
    [path, setPath] = useState<number[]>([]);
  const render = (items: ViewEntry[], prefix: number[] = []): React.ReactNode =>
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
              {render(entry.children, [...prefix, index])}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )
      ) : entry.toggle ? (
        <DropdownMenuCheckboxItem
          key={entry.label}
          disabled={entry.disabled}
          checked={entry.checked}
          onSelect={(e) => {
            if (entry.keepOpen !== false) e.preventDefault();
          }}
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
  let current = entries,
    title = "Vue";
  for (const index of path) {
    if (!current[index]?.children) break;
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
        data-view-menu-content
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
            <DropdownMenuLabel aria-live="polite">{title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {render(current, path)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
