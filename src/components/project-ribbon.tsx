import type { ReactNode } from "react";

/** A named section of the single, horizontally scrollable project ribbon. */
export function RibbonGroup({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`ribbon-group ${className}`}
      role="group"
      aria-label={label}
    >
      <span className="ribbon-legend" aria-hidden="true">
        {label}
      </span>
      <div className="ribbon-fields">{children}</div>
    </div>
  );
}
