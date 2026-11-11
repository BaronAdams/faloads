import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Hand, LocateFixed, Minus, MousePointer2, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { IconButton } from "./common";
interface View {
  k: number;
  x: number;
  y: number;
}
export function Playground({
  children,
  onSelect,
  height = 350,
  label = "Schéma interactif",
}: {
  children: ReactNode;
  onSelect?: (key: string) => void;
  height?: number;
  label?: string;
}) {
  const svg = useRef<SVGSVGElement>(null),
    [view, setView] = useState<View>({ k: 1, x: 0, y: 0 }),
    v = useRef(view),
    [hand, setHand] = useState(false),
    space = useRef(false),
    points = useRef(new Map<number, { x: number; y: number }>()),
    drag = useRef<{
      x: number;
      y: number;
      key: string | null;
      moved: boolean;
    } | null>(null),
    pattern = useId().replace(/:/g, "");
  const apply = (next: View) => {
    v.current = next;
    setView(next);
  };
  const local = (x: number, y: number) => {
    const p = svg.current!.createSVGPoint();
    p.x = x;
    p.y = y;
    return p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
  };
  const zoom = (factor: number, x = 500, y = 210) => {
    const old = v.current,
      k = Math.max(0.3, Math.min(7, old.k * factor));
    apply({
      k,
      x: x - ((x - old.x) * k) / old.k,
      y: y - ((y - old.y) * k) / old.k,
    });
  };
  useEffect(() => {
    const el = svg.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const p = local(event.clientX, event.clientY);
      zoom(Math.exp(-event.deltaY * 0.0015), p.x, p.y);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const positions = () => [...points.current.values()];
  return (
    <section className="playground" aria-label={label}>
      <div className="playground-toolbar">
        <span className="canvas-caption">{label}</span>
        <div className="segmented">
          <Button
            size="sm"
            variant={!hand ? "secondary" : "ghost"}
            onClick={() => setHand(false)}
            aria-pressed={!hand}
          >
            <MousePointer2 size={15} />
            <span>Sélection</span>
          </Button>
          <Button
            size="sm"
            variant={hand ? "secondary" : "ghost"}
            onClick={() => setHand(true)}
            aria-pressed={hand}
          >
            <Hand size={15} />
            <span>Déplacer</span>
          </Button>
        </div>
      </div>
      <svg
        ref={svg}
        data-testid="playground"
        viewBox="0 0 1000 420"
        style={{
          height,
          cursor: hand ? "grab" : "default",
          touchAction: "none",
        }}
        tabIndex={0}
        role="application"
        aria-label="Schéma zoomable et déplaçable"
        onKeyDown={(e) => {
          if (e.code === "Space") {
            e.preventDefault();
            space.current = true;
          }
          if (e.key === "+") zoom(1.2);
          if (e.key === "-") zoom(1 / 1.2);
          if (e.key === "0") apply({ k: 1, x: 0, y: 0 });
        }}
        onKeyUp={(e) => {
          if (e.code === "Space") space.current = false;
        }}
        onBlur={() => {
          space.current = false;
        }}
        onPointerDown={(e) => {
          const p = local(e.clientX, e.clientY);
          points.current.set(e.pointerId, p);
          const key =
            (e.target as Element)
              .closest("[data-element]")
              ?.getAttribute("data-element") ?? null;
          drag.current = { ...p, key, moved: false };
          if (
            hand ||
            space.current ||
            e.button === 1 ||
            e.pointerType === "touch"
          )
            svg.current!.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!points.current.has(e.pointerId)) return;
          const before = positions(),
            p = local(e.clientX, e.clientY),
            old = points.current.get(e.pointerId)!;
          points.current.set(e.pointerId, p);
          const after = positions();
          if (before.length === 2 && after.length === 2) {
            const d0 = Math.hypot(
                before[0].x - before[1].x,
                before[0].y - before[1].y,
              ),
              d1 = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
            zoom(
              d1 / Math.max(1, d0),
              (before[0].x + before[1].x) / 2,
              (before[0].y + before[1].y) / 2,
            );
            apply({
              ...v.current,
              x:
                v.current.x +
                (after[0].x + after[1].x - before[0].x - before[1].x) / 2,
              y:
                v.current.y +
                (after[0].y + after[1].y - before[0].y - before[1].y) / 2,
            });
            if (drag.current) drag.current.moved = true;
          } else if (
            drag.current &&
            (hand ||
              space.current ||
              e.buttons === 4 ||
              e.pointerType === "touch")
          ) {
            apply({
              ...v.current,
              x: v.current.x + p.x - old.x,
              y: v.current.y + p.y - old.y,
            });
            if (Math.hypot(p.x - drag.current.x, p.y - drag.current.y) > 4)
              drag.current.moved = true;
          }
        }}
        onPointerUp={(e) => {
          points.current.delete(e.pointerId);
          if (
            drag.current &&
            !drag.current.moved &&
            !hand &&
            !space.current &&
            drag.current.key
          )
            onSelect?.(drag.current.key);
          drag.current = null;
        }}
        onPointerCancel={(e) => {
          points.current.delete(e.pointerId);
          drag.current = null;
        }}
      >
        <defs>
          <pattern
            id={pattern}
            width="25"
            height="25"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M25 0H0V25"
              fill="none"
              stroke="var(--border)"
              strokeOpacity=".25"
              strokeWidth=".7"
            />
          </pattern>
        </defs>
        <rect width="1000" height="420" fill={`url(#${pattern})`} />
        <g
          data-testid="camera"
          transform={`translate(${view.x} ${view.y}) scale(${view.k})`}
        >
          {children}
        </g>
      </svg>
      <footer className="playground-footer">
        <small>Molette / pincement : zoom · Espace + glisser : déplacer</small>
        <div>
          <IconButton label="Réduire le zoom" onClick={() => zoom(1 / 1.2)}>
            <Minus />
          </IconButton>
          <span className="mono" data-testid="zoom-level">
            {Math.round(view.k * 100)} %
          </span>
          <IconButton label="Augmenter le zoom" onClick={() => zoom(1.2)}>
            <Plus />
          </IconButton>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => apply({ k: 1, x: 0, y: 0 })}
          >
            <LocateFixed />
            Recentrer
          </Button>
        </div>
      </footer>
    </section>
  );
}
export function Arrow({
  x,
  y,
  dx = 0,
  dy = -50,
  color = "var(--orange)",
  label,
}: {
  x: number;
  y: number;
  dx?: number;
  dy?: number;
  color?: string;
  label?: string;
}) {
  const len = Math.hypot(dx, dy) || 1,
    nx = dx / len,
    ny = dy / len,
    tipX = x + dx,
    tipY = y + dy;
  return (
    <g stroke={color} fill={color}>
      <line x1={x} y1={y} x2={tipX} y2={tipY} strokeWidth="2" />
      <path
        d={`M${tipX} ${tipY}L${tipX - 8 * nx + 4 * ny} ${tipY - 8 * ny - 4 * nx}L${tipX - 8 * nx - 4 * ny} ${tipY - 8 * ny + 4 * nx}Z`}
        stroke="none"
      />
      {label && (
        <text
          x={x + dx / 2 + (x > 800 ? -8 : 8)}
          textAnchor={x > 800 ? "end" : "start"}
          y={y + dy / 2 - 8}
          fontSize="13"
          stroke="none"
          className="numeric"
        >
          {label}
        </text>
      )}
    </g>
  );
}
export function Support({
  x,
  y,
  type = 2,
}: {
  x: number;
  y: number;
  type?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      stroke="var(--foreground)"
      strokeWidth="1.6"
      fill="var(--plot)"
    >
      {type === 1 ? (
        <>
          <line x1="-15" y1="4" x2="15" y2="4" strokeWidth="4" />
          {[-12, -4, 4, 12].map((p) => (
            <line key={p} x1={p} y1="4" x2={p - 7} y2="14" />
          ))}
        </>
      ) : (
        <>
          <path d="M0 1L-11 18H11Z" />
          {type === 3 ? (
            <>
              <circle cx="-6" cy="23" r="2.3" />
              <circle cx="6" cy="23" r="2.3" />
              <line x1="-15" x2="15" y1="28" y2="28" />
            </>
          ) : (
            <line x1="-15" x2="15" y1="22" y2="22" />
          )}
        </>
      )}
    </g>
  );
}
