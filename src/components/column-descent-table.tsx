import type { buildingDescent } from "@/domain/building";
import { Panel, Choice } from "./common";
import { useState } from "react";
import { fmt } from "@/lib/utils";
export function ColumnDescentTable({
  rows,
}: {
  rows: ReturnType<typeof buildingDescent>;
}) {
  const [file, setFile] = useState("all");
  const columns = rows.flatMap((r) => [
    ...r.results.columns.map((n) => ({
      ...n,
      identity: `${n.x},${n.y}`,
      level: r.name,
    })),
    ...r.results.obliques
      .filter((o) => o.kind === "column")
      .map((o) => ({
        ...o,
        identity: `${o.x1},${o.y1}`,
        level: r.name,
        key: o.id,
        nEls: o.els,
        nElu: o.elu,
      })),
  ]);
  const files = [
    ...new Map(columns.map((n) => [n.identity, n.label])).entries(),
  ];
  return (
    <Panel
      title="Poteaux · détail étage par étage"
      description="Chaque file est cumulée du sommet vers le bas, selon les liaisons réelles du modèle."
    >
      <Choice
        label="File de poteaux"
        value={file}
        onChange={setFile}
        options={[
          { value: "all", label: "Tous les poteaux" },
          ...files.map(([value, label]) => ({
            value,
            label: `${label} · (${value}) m`,
          })),
        ]}
      />
      <div
        className="table-wrap column-cumulative-wrap"
        tabIndex={0}
        aria-label="Cumul des poteaux, tableau défilant"
      >
        <table data-testid="column-cumulative">
          <thead>
            <tr>
              <th>Niveau</th>
              <th>Poteau</th>
              <th>G étage · kN</th>
              <th>G supérieur · kN</th>
              <th>ΣG · kN</th>
              <th>ΣQ brut · kN</th>
              <th>ΣQ réduit · kN</th>
              <th>ELS · kN</th>
              <th>ELU · kN</th>
              <th>Origine</th>
            </tr>
          </thead>
          <tbody>
            {columns
              .filter((n) => file === "all" || n.identity === file)
              .map((n) => {
                const local = n.sources[0],
                  raw = n.live.reduce((s, v) => s + v.q, 0);
                return (
                  <tr key={`${n.level}-${n.key}`}>
                    <th>{n.level}</th>
                    <td>{n.label}</td>
                    {[
                      local.g,
                      n.g - local.g,
                      n.g,
                      raw,
                      n.q,
                      n.nEls,
                      n.nElu,
                    ].map((v, i) => (
                      <td key={i}>{fmt(v)}</td>
                    ))}
                    <td>
                      <details>
                        <summary>{n.sources.length} niveau(x)</summary>
                        {n.sources
                          .slice()
                          .reverse()
                          .map((s) => (
                            <p key={s.floor}>
                              {s.name} · G {fmt(s.g)} · Q {fmt(s.q)} kN
                            </p>
                          ))}
                      </details>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
