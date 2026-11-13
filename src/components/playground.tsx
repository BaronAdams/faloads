import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Hand, LocateFixed, Minus, MousePointer2, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { IconButton } from "./common";
interface View {
  k: number;
  x: number;
  y: number;
}
const CanvasGeometry = createContext({ units: 1, height: 420 });
export const useCanvasGeometry = () => useContext(CanvasGeometry);
export function Playground({
  children,
  onSelect,
  height = 350,
  label = "Schéma interactif",
  selected,
  onDeselect,
  controls,
  immersive = false,
}: {
  children: ReactNode;
  onSelect?: (key: string) => void;
  height?: number;
  label?: string;
  selected?: string | null;
  onDeselect?: () => void;
  controls?: ReactNode;
  immersive?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null),
    content = useRef<SVGGElement>(null),
    [geometry, setGeometry] = useState({ units: 1, height: 420 }),
    [selectionBox, setSelectionBox] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null),
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
  const zoom = (factor: number, x = 500, y = geometry.height / 2) => {
    const old = v.current,
      k = Math.max(0.3, Math.min(7, old.k * factor));
    apply({
      k,
      x: x - ((x - old.x) * k) / old.k,
      y: y - ((y - old.y) * k) / old.k,
    });
  };
  useLayoutEffect(() => {
    const element = svg.current!;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const viewHeight = Math.max(320, (1000 * height) / width);
      setGeometry({
        units: Math.max(1000 / width, viewHeight / height),
        height: viewHeight,
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const target = [
      ...(content.current?.querySelectorAll<SVGGraphicsElement>(
        "[data-element]",
      ) ?? []),
    ].find((element) => element.getAttribute("data-element") === selected);
    if (!target) {
      setSelectionBox(null);
      return;
    }
    const shape =
      target.querySelector<SVGGraphicsElement>("[data-selection-bounds]") ??
      target;
    const bounds = shape.getBBox();
    const cameraMatrix = content.current?.getCTM();
    const shapeMatrix = shape.getCTM();
    const matrix =
      cameraMatrix && shapeMatrix
        ? cameraMatrix.inverse().multiply(shapeMatrix)
        : null;
    const corners = [
      [bounds.x, bounds.y],
      [bounds.x + bounds.width, bounds.y],
      [bounds.x, bounds.y + bounds.height],
      [bounds.x + bounds.width, bounds.y + bounds.height],
    ].map(([x, y]) =>
      matrix ? new DOMPoint(x, y).matrixTransform(matrix) : { x, y },
    );
    const left = Math.min(...corners.map((point) => point.x)),
      top = Math.min(...corners.map((point) => point.y));
    const right = Math.max(...corners.map((point) => point.x)),
      bottom = Math.max(...corners.map((point) => point.y));
    const gap = 5 * geometry.units;
    setSelectionBox({
      x: left - gap,
      y: top - gap,
      width: right - left + gap * 2,
      height: bottom - top + gap * 2,
    });
  }, [selected, children, geometry]);
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
    <section
      className={`playground ${immersive ? "immersive-playground" : ""}`}
      aria-label={label}
    >
      <div className="playground-toolbar">
        <span className="canvas-caption">{label}</span>
        <div className="segmented">
          <Button
            size="sm"
            variant={!hand ? "secondary" : "ghost"}
            aria-label="Sélection"
            onClick={() => setHand(false)}
            aria-pressed={!hand}
          >
            <MousePointer2 size={15} />
            <span>Sélection</span>
          </Button>
          <Button
            size="sm"
            variant={hand ? "secondary" : "ghost"}
            aria-label="Déplacer"
            onClick={() => setHand(true)}
            aria-pressed={hand}
          >
            <Hand size={15} />
            <span>Déplacer</span>
          </Button>
        </div>
      </div>
      {controls && <div className="playground-overlays">{controls}</div>}
      <svg
        ref={svg}
        data-testid="playground"
        viewBox={`0 0 1000 ${geometry.height}`}
        style={
          {
            height,
            cursor: hand ? "grab" : "default",
            touchAction: "none",
            "--drawing-text-size": `${12 * geometry.units}px`,
            "--drawing-number-size": `${11 * geometry.units}px`,
          } as React.CSSProperties
        }
        tabIndex={0}
        role="application"
        aria-label="Schéma zoomable et déplaçable"
        onKeyDown={(e) => {
          const key = (e.target as Element)
            .closest("[data-element]")
            ?.getAttribute("data-element");
          if (key && e.key === "Enter") {
            e.preventDefault();
            onSelect?.(key);
            return;
          }
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
          drag.current = { x: p.x, y: p.y, key, moved: false };
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
          else if (
            drag.current &&
            !drag.current.moved &&
            !drag.current.key &&
            !hand &&
            !space.current
          )
            onDeselect?.();
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
        <rect width="1000" height={geometry.height} fill={`url(#${pattern})`} />
        <g
          ref={content}
          data-testid="camera"
          transform={`translate(${view.x} ${view.y}) scale(${view.k})`}
        >
          <CanvasGeometry.Provider value={geometry}>
            {children}
          </CanvasGeometry.Provider>
          {selectionBox && (
            <rect
              {...selectionBox}
              data-testid="selection-highlight"
              className="selection-highlight"
              pointerEvents="none"
              vectorEffect="non-scaling-stroke"
            />
          )}
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
  const { units } = useCanvasGeometry();
  const len = Math.hypot(dx, dy) || 1,
    nx = dx / len,
    ny = dy / len,
    tipX = x + dx,
    tipY = y + dy;
  return (
    <g stroke={color} fill={color}>
      <line
        x1={x}
        y1={y}
        x2={tipX}
        y2={tipY}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M${tipX} ${tipY}L${tipX - 7 * units * nx + 3 * units * ny} ${tipY - 7 * units * ny - 3 * units * nx}L${tipX - 7 * units * nx - 3 * units * ny} ${tipY - 7 * units * ny + 3 * units * nx}Z`}
        stroke="none"
      />
      {label && (
        <text
          x={x + dx / 2 + (x > 800 ? -8 : 8) * units}
          textAnchor={x > 800 ? "end" : "start"}
          y={y + dy / 2 - 8 * units}
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
  const { units } = useCanvasGeometry();
  return (
    <g
      transform={`translate(${x} ${y})${type === 4 ? " rotate(-90)" : ""} scale(${Math.max(1, units * 0.85)})`}
      data-support-type={type === 5 ? "spring" : type}
      data-selection-bounds="true"
      stroke="var(--foreground)"
      strokeWidth="1.6"
      fill="var(--plot)"
    >
      {type === 5 ? (
        <>
          <path
            d="M0 0V6L-8 10L8 16L-8 22L8 28L-8 34L0 38V44"
            fill="none"
            strokeWidth="2.4"
          />
          <line x1="-15" x2="15" y1="44" y2="44" strokeWidth="2.4" />
          {[-12, -4, 4, 12].map((p) => (
            <line key={p} x1={p} y1="44" x2={p - 6} y2="51" />
          ))}
        </>
      ) : type === 1 ? (
        <>
          <line x1="-15" y1="4" x2="15" y2="4" strokeWidth="4" />
          {[-12, -4, 4, 12].map((p) => (
            <line key={p} x1={p} y1="4" x2={p - 7} y2="14" />
          ))}
        </>
      ) : (
        <>
          <path d="M0 1L-11 18H11Z" />
          {type === 3 || type === 4 ? (
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
