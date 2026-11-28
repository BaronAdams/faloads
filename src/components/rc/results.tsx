import type { RCModel } from "@/domain/rc/model";
import type { RCResult } from "@/lib/rc-engine";
import { Metric, Disclosure } from "@/components/common";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { fmt } from "@/lib/utils";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
type ResultCategory =
  "summary" | "analysis" | "longitudinal" | "transverse" | "checks";
const ResultContext = createContext<ResultCategory>("summary");
function Category({
  category,
  children,
}: {
  category: ResultCategory;
  children: ReactNode;
}) {
  return useContext(ResultContext) === category ? <>{children}</> : null;
}
export const rcValue = (v: unknown): string =>
  typeof v === "number"
    ? fmt(v, 2)
    : Array.isArray(v)
      ? v.map(rcValue).join(" – ")
      : v == null
        ? "—"
        : String(v);
function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="rc-table-wrap">
      <table className="rc-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>{typeof v === "number" ? fmt(v, 2) : v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Section({
  title,
  children,
  category = "summary",
}: {
  title: string;
  children: ReactNode;
  category?: ResultCategory;
}) {
  if (useContext(ResultContext) !== category) return null;
  return (
    <section className="rc-result-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
export function RCResults({
  model: m,
  result: r,
  onAlternative,
}: {
  model: RCModel;
  result: RCResult;
  onAlternative?: (bars: any) => void;
}) {
  const [category, setCategory] = useState<ResultCategory>("summary");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = root.current?.closest(".rc-result-body");
    if (body) body.scrollTop = 0;
  }, [category]);
  const failed = r.checks.filter((c) => !c.ok),
    lay = r.reinforcement?.layout;
  return (
    <ResultContext.Provider value={category}>
      <div className="rc-results" ref={root} data-testid="rc-results">
        <nav
          className="rc-result-categories"
          aria-label="Catégories des résultats"
        >
          {(
            [
              ["summary", "Synthèse"],
              ["analysis", "Analyse"],
              ["longitudinal", "Longitudinal"],
              ["transverse", "Cadres"],
              ["checks", "Vérifications"],
            ] as const
          ).map(([id, label]) => (
            <Button
              type="button"
              key={id}
              size="sm"
              variant={category === id ? "secondary" : "ghost"}
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
            >
              {label}
              {id === "checks" && failed.length > 0 && (
                <span className="rc-category-count">{failed.length}</span>
              )}
            </Button>
          ))}
        </nav>
        <Category category="summary">
          <div
            role="status"
            className={`rc-verdict ${failed.length || !r.scope_complete ? "attention" : "passed"}`}
          >
            {failed.length || !r.scope_complete ? (
              <TriangleAlert size={20} />
            ) : (
              <CircleCheck size={20} />
            )}
            <div>
              <strong>
                {failed.length
                  ? `${failed.length} contrôle${failed.length > 1 ? "s" : ""} à corriger`
                  : !r.scope_complete
                    ? "Vérification complémentaire nécessaire"
                    : "Contrôles calculés satisfaits"}
              </strong>
              <p>
                {r.scope_complete
                  ? "Dans le domaine de calcul indiqué ci-dessous"
                  : "Les contrôles disponibles ne couvrent pas toutes les sollicitations saisies"}
              </p>
            </div>
          </div>
        </Category>
        {m.kind === "rc-beam" && (
          <Section title="Ferraillage retenu">
            <div className="metrics-grid">
              <Metric
                label="Moment maximal en travée"
                value={Math.max(...r.spans.map((v: any) => v.MEd_kNm))}
                unit="kN·m"
              />
              <Metric
                label="Travées calculées"
                value={r.spans.length}
                unit=""
              />
              <Metric
                label="Acier inférieur · travée 1"
                value={`${r.spans[0].tension.count} HA${r.spans[0].tension.phi_mm}`}
                unit=""
              />
              <Metric
                label="Cadres"
                value={`HA${m.detailing.phi_t_mm}`}
                unit=""
              />
            </div>
            <p className="hint">
              Les détails de flexion, d’ancrage et de répartition sont répartis
              dans les catégories ci-dessus.
            </p>
          </Section>
        )}
        {m.kind === "rc-column" ? (
          <>
            <Section title="Armatures retenues">
              <div className="metrics-grid">
                <Metric
                  label="Acier longitudinal"
                  value={`${lay.n} HA${lay.phi}${lay.mixed ? ` / HA${lay.phi_i}` : ""}`}
                  unit=""
                />
                <Metric label="As fourni" value={lay.As_prov} unit="cm²" />
                <Metric
                  label="As requis"
                  value={r.reinforcement.As_req_tot_cm2}
                  unit="cm²"
                />
                <Metric
                  label="Niveau retenu"
                  value={
                    r.circular
                      ? "Compression"
                      : r.final_stage === 1
                        ? "Compression"
                        : r.final_stage === 2
                          ? "Premier ordre"
                          : r.final_stage === 3
                            ? "Second ordre"
                            : "Vérification"
                  }
                  unit=""
                />
              </div>
              <p className="hint">
                Ferraillage symétrique · d’ réel {fmt(lay.e_mm, 1)} mm
              </p>
            </Section>
            <Section title="Combinaisons dimensionnantes" category="analysis">
              <Table
                headers={["Combinaison", "N tête (kN)", "N pied (kN)"]}
                rows={r.combinations.map((c: any) => [
                  c.name,
                  c.N_top_kN,
                  c.N_base_kN,
                ])}
              />
            </Section>
            {!r.circular && (
              <>
                <Section
                  title="Stabilité dans les deux plans"
                  category="analysis"
                >
                  <Table
                    headers={["Plan", "l₀ (m)", "λ"]}
                    rows={["y", "z"].map((p) => [
                      p,
                      r.geometry[`plane_${p}`].l0_m,
                      r.geometry[`plane_${p}`].lambda,
                    ])}
                  />
                  <Disclosure title="Critères d’élancement par combinaison">
                    <Table
                      headers={["Cas / plan", "λ", "λlim", "Second ordre"]}
                      rows={r.verification.buckling.map((b: any) => [
                        `${b.case} / ${b.plane}`,
                        b.lambda ?? b.lam ?? "—",
                        b.lambda_lim ?? b.lam_lim ?? "—",
                        b.ok
                          ? "Dispense confirmée"
                          : "Pris en compte / contrôle requis",
                      ])}
                    />
                  </Disclosure>
                </Section>
                <Section title="Démarche de calcul" category="analysis">
                  {r.cascade.map((s: any, i: number) => (
                    <div className="rc-stage" key={i}>
                      <span>{s.stage}</span>
                      <div>
                        <strong>{s.title}</strong>
                        <p>
                          {s.reason ??
                            s.verdict ??
                            (s.converged === false
                              ? "Convergence non atteinte"
                              : s.stage === r.final_stage
                                ? "Niveau retenu"
                                : "Niveau examiné")}
                        </p>
                        {s.iterations && (
                          <small>{s.iterations.length} itération(s)</small>
                        )}
                      </div>
                    </div>
                  ))}
                  <Disclosure title="Résistances par section">
                    <Table
                      headers={[
                        "Combinaison / plan",
                        "Section",
                        "MEd (kN·m)",
                        "MRd (kN·m)",
                        "État",
                      ]}
                      rows={r.verification.sections.flatMap((v: any) =>
                        v.sections.map((s: any) => [
                          `${v.combo} / ${v.plane}`,
                          s.name,
                          s.M,
                          s.MRd ?? "—",
                          s.ok ? "Satisfait" : "À corriger",
                        ]),
                      )}
                    />
                  </Disclosure>
                  <Disclosure title="Effets du second ordre">
                    <Table
                      headers={[
                        "Combinaison / plan",
                        "M0Ed (kN·m)",
                        "φef",
                        "e2 (mm) / EI (MN·m²)",
                        "MEd (kN·m)",
                      ]}
                      rows={r.verification.sections.flatMap((v: any) =>
                        v.sections
                          .filter((s: any) => s.second_order)
                          .map((s: any) => {
                            const t = s.second_order;
                            return [
                              `${v.combo} / ${v.plane}`,
                              t.M0Ed_kNm,
                              t.phi_ef_used,
                              t.method === "courbure"
                                ? t.e2_m * 1000
                                : t.EI_MNm2,
                              t.MEd_kNm,
                            ];
                          }),
                      )}
                    />
                  </Disclosure>
                </Section>
              </>
            )}
            <Section title="Cadres et recouvrements" category="transverse">
              <Table
                headers={["Disposition", "Valeur"]}
                rows={[
                  ["Cadres", `HA${r.reinforcement.transverse.phi_t_mm}`],
                  ["Pas courant (cm)", r.reinforcement.transverse.s_current_cm],
                  ["Pas aux nœuds (cm)", r.reinforcement.transverse.s_node_cm],
                  ...(r.reinforcement.lap
                    ? [["Recouvrement l₀ (cm)", r.reinforcement.lap.l0_cm]]
                    : []),
                ]}
              />
              {r.reinforcement.lap && (
                <p className="hint">
                  {r.reinforcement.lap.basis ??
                    "Recouvrement des barres comprimées suivant le skill fourni."}
                </p>
              )}
            </Section>
            <Section title="Armatures longitudinales" category="longitudinal">
              <p>
                {lay.n} HA{lay.phi} · As fourni {fmt(lay.As_prov, 2)} cm² · As
                requis {fmt(r.reinforcement.As_req_tot_cm2, 2)} cm²
              </p>
            </Section>
            {r.reinforcement.alternatives?.length > 0 && (
              <Category category="longitudinal">
                <Disclosure title="Autres dispositions à vérifier">
                  <p className="hint">
                    Choisir une alternative impose un nouveau calcul complet de
                    stabilité.
                  </p>
                  {r.reinforcement.alternatives.map((a: any, i: number) => (
                    <button
                      className="rc-alternative"
                      key={i}
                      onClick={() => onAlternative?.(a)}
                    >
                      {a.n} barres · HA{a.phi}
                      {a.mixed ? ` / HA${a.phi_i}` : ""}
                      <span>{fmt(a.As_prov, 2)} cm² →</span>
                    </button>
                  ))}
                </Disclosure>
              </Category>
            )}
          </>
        ) : (
          <>
            <Section title="Analyse retenue" category="analysis">
              <p>
                {r.method === "elastic"
                  ? "Élastique — trois moments"
                  : "Plastique — équilibre statique"}{" "}
                · {r.cases.length} disposition(s) de charges
              </p>
              <p className="hint">
                Poids propre {fmt(r.self_weight_kN_m, 2)} kN/m · fcd{" "}
                {fmt(r.materials.fcd, 2)} MPa · fyd {fmt(r.materials.fyd, 2)}{" "}
                MPa
              </p>
            </Section>
            <Section
              title="Flexion — travées et appuis"
              category="longitudinal"
            >
              <Table
                headers={[
                  "Section",
                  "MEd (kN·m)",
                  "As requis (cm²)",
                  "As fourni (cm²)",
                  "Barres",
                ]}
                rows={[...r.spans, ...r.supports].map((s: any) => [
                  s.label,
                  s.MEd_kNm,
                  s.As1_req_mm2 / 100,
                  s.tension.area_mm2 / 100,
                  `${s.tension.count} HA${s.tension.phi_mm}`,
                ])}
              />
              {[...r.spans, ...r.supports].map((s: any) => (
                <Disclosure key={s.id} title={`${s.label} — détail de section`}>
                  <Table
                    headers={["Grandeur", "Valeur"]}
                    rows={[
                      [
                        "d retenu / réel (mm)",
                        `${fmt(s.d_mm, 1)} / ${fmt(s.actual_d_mm, 1)}`,
                      ],
                      ["μ / μlim", `${fmt(s.mu, 4)} / ${fmt(s.mu_limit, 4)}`],
                      ["x/d", s.alpha],
                      ["Bras de levier z (mm)", s.z_mm],
                      ["As comprimé requis (cm²)", s.As2_req_mm2 / 100],
                      [
                        "As supérieur / montage (cm²)",
                        s.compression.area_mm2 / 100,
                      ],
                    ]}
                  />
                  {s.service && (
                    <Table
                      headers={["ELS", "Calculé", "Limite"]}
                      rows={[
                        [
                          "σs (MPa)",
                          s.service.sigma_s_MPa,
                          s.service.sigma_s_limit_MPa,
                        ],
                        [
                          "σc (MPa)",
                          s.service.sigma_c_MPa,
                          s.service.sigma_c_limit_MPa ??
                            "Non imposée par ce profil",
                        ],
                      ]}
                    />
                  )}
                  <p className="hint">
                    {s.service
                      ? `Section ${s.service.cracked ? "fissurée" : "non fissurée"} à l’ELS`
                      : "Contraintes ELS non vérifiées"}
                    .{" "}
                    {s.clipping_kNm != null
                      ? `Écrêtage d’appui : ${fmt(s.clipping_kNm, 2)} kN·m.`
                      : ""}
                  </p>
                </Disclosure>
              ))}
            </Section>
            <Section title="Effort tranchant et cadres" category="transverse">
              <Table
                headers={[
                  "Travée / côté",
                  "VEd (kN)",
                  "VRdc (kN)",
                  "VRd,max (kN)",
                  "cot θ",
                  "Pas (mm)",
                ]}
                rows={r.shear.flatMap((s: any, i: number) =>
                  s.critical.map((c: any) => [
                    `${i + 1} / ${c.side}`,
                    c.VEd_kN,
                    c.VRdc_kN,
                    c.VRdmax_kN,
                    c.cot_theta,
                    c.spacing_mm,
                  ]),
                )}
              />
              {r.shear.map((s: any, i: number) => (
                <Disclosure
                  key={i}
                  title={`${m.spans[i].name} — répartition des ${s.count} cadres`}
                >
                  <Table
                    headers={[
                      "Côté",
                      "Depuis (m)",
                      "Jusqu’à (m)",
                      "Pas (mm)",
                      "Nombre",
                    ]}
                    rows={s.zones.map((z: any) => [
                      z.side === 0
                        ? "Gauche"
                        : z.side === 1
                          ? "Droite"
                          : "Complément",
                      z.start_m,
                      z.end_m,
                      z.spacing_mm,
                      z.count,
                    ])}
                  />
                </Disclosure>
              ))}
            </Section>
            <Section
              title="Arrêts de barres et ancrages"
              category="longitudinal"
            >
              {r.bars.map((s: any, i: number) => (
                <Disclosure
                  key={i}
                  title={`${m.spans[i].name} — longueurs de principe`}
                >
                  <Table
                    headers={[
                      "Nappe / groupe",
                      "Barres",
                      "Début (m)",
                      "Fin (m)",
                      "Longueur (m)",
                    ]}
                    rows={["bottom", "top"].flatMap((k) =>
                      s[k].groups.map((b: any) => [
                        `${k === "bottom" ? "Bas" : "Haut"} / ${b.id}`,
                        `${b.count} HA${b.phi_mm}`,
                        b.start_m,
                        b.end_m,
                        b.length_m,
                      ]),
                    )}
                  />
                  <p className="hint">
                    Abscisses depuis le nœud de calcul. Longueurs à confirmer
                    sur le plan d’exécution, notamment les barres communes sur
                    appuis.
                  </p>
                  {["bottom", "top"].flatMap((nappe) =>
                    ["left_end", "right_end"].map(
                      (k) =>
                        s[nappe][k] && (
                          <p key={`${nappe}-${k}`}>
                            Ancrage{" "}
                            {nappe === "bottom" ? "inférieur" : "supérieur"}{" "}
                            {k === "left_end" ? "gauche" : "droit"} :{" "}
                            {s[nappe][k].lbd_mm} mm / disponible{" "}
                            {fmt(s[nappe][k].available_mm, 0)} mm
                          </p>
                        ),
                    ),
                  )}
                </Disclosure>
              ))}
            </Section>
            {r.flange?.length > 0 && (
              <Section title="Couture hourdis–nervure" category="transverse">
                <Table
                  headers={[
                    "Travée",
                    "vEd (MPa)",
                    "vRd,max (MPa)",
                    "Acier par côté",
                  ]}
                  rows={r.flange.map((f: any, i: number) => [
                    String(i + 1),
                    f.vEd_MPa,
                    f.VRdmax_MPa,
                    `HA${f.phi_mm} / ${f.spacing_mm} mm`,
                  ])}
                />
              </Section>
            )}
            {r.comparison?.length > 0 && (
              <Section
                title="Comparaison élastique / plastique"
                category="analysis"
              >
                <Table
                  headers={[
                    "Travée",
                    "Mélast. (kN·m)",
                    "Mplast. (kN·m)",
                    "As élast. (cm²)",
                    "As plast. (cm²)",
                  ]}
                  rows={r.comparison.map((c: any) => [
                    String(c.span + 1),
                    c.elastic_kNm,
                    c.plastic_kNm,
                    c.elastic_As_mm2 / 100,
                    c.plastic_As_mm2 / 100,
                  ])}
                />
                <ul className="rc-check-list">
                  {r.plastic_checks.map((c: any, i: number) => (
                    <li key={i} className={c.ok ? "" : "failed"}>
                      {c.ok ? "✓" : "!"} {c.name}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {r.redistribution.length > 0 && (
              <Category category="analysis">
                <Disclosure title="Redistributions appliquées">
                  <Table
                    headers={[
                      "Cas / appui",
                      "Avant (kN·m)",
                      "Après (kN·m)",
                      "δ",
                    ]}
                    rows={r.redistribution.map((d: any) => [
                      `${d.case} / ${d.support}`,
                      d.before_kNm,
                      d.after_kNm,
                      d.delta,
                    ])}
                  />
                </Disclosure>
              </Category>
            )}
          </>
        )}
        <Section title="Contrôles" category="checks">
          <ul className="rc-check-list">
            {[...failed, ...r.checks.filter((c) => c.ok)].map((c, i) => (
              <li key={i} className={c.ok ? "" : "failed"}>
                {c.ok ? <CircleCheck size={15} /> : <TriangleAlert size={15} />}
                <div>
                  {c.name}
                  {c.value != null && (
                    <small>
                      {rcValue(c.value)} {c.unit ?? ""}
                      {c.limit != null
                        ? ` · référence ${rcValue(c.limit)} ${c.unit ?? ""}`
                        : ""}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
        {r.warnings.length > 0 && (
          <Section title="Points d’attention" category="checks">
            <ul className="rc-warning-list">
              {r.warnings.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Section>
        )}
        <Section
          title="Domaine et vérifications complémentaires"
          category="checks"
        >
          <ul className="rc-warning-list">
            {r.limits.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
        <Category category="checks">
          <Disclosure title="Hypothèses et détails du moteur">
            <ul className="rc-warning-list">
              {r.notes.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Disclosure>
        </Category>
      </div>
    </ResultContext.Provider>
  );
}
