export function BuildingCriticalIcon({ kind }: { kind: "column" | "beam" }) {
  return (
    <svg
      data-critical-icon={kind}
      viewBox="0 0 32 32"
      fill="none"
      stroke="var(--destructive)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "column" ? (
        <>
          <path d="M12 11h8v17h-8zM9 29h14M16 3v12m-3-3 3 3 3-3" />
          <text
            x="23"
            y="10"
            stroke="none"
            fill="var(--destructive)"
            fontSize="7"
            textAnchor="middle"
          >
            max
          </text>
        </>
      ) : (
        <>
          <path d="M3 24h26v4H3zM4 10h24M6 10v11m-2-3 2 3 2-3M16 10v11m-2-3 2 3 2-3M26 10v11m-2-3 2 3 2-3" />
          <text
            x="16"
            y="7"
            stroke="none"
            fill="var(--destructive)"
            fontSize="7"
            textAnchor="middle"
          >
            max
          </text>
        </>
      )}
    </svg>
  );
}
