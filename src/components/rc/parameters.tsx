import type { RCModel, RCColumnModel, RCAction } from "@/domain/rc/model";
import { newRCAction } from "@/domain/rc/model";
import {
  Numeric,
  Choice,
  FormGrid,
  Disclosure,
  IconButton,
} from "@/components/common";
import { SectionSketch, ProfileIcon } from "@/components/section-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy } from "lucide-react";
import { uid } from "@/lib/utils";
import type { ReactNode } from "react";
export type RCTab =
  "geometry" | "materials" | "loads" | "detailing" | "analysis";
export const rcTabs: { id: RCTab; label: string }[] = [
  { id: "geometry", label: "Géométrie" },
  { id: "materials", label: "Matériaux" },
  { id: "loads", label: "Actions" },
  { id: "detailing", label: "Armatures" },
  { id: "analysis", label: "Méthode" },
];
export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="rc-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rc-form-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
const diameters = [8, 10, 12, 14, 16, 20, 25, 32];
export function RCParameters({
  model: m,
  onChange,
  tab,
}: {
  model: RCModel;
  onChange: (m: RCModel) => void;
  tab: RCTab;
}) {
  const set = (path: string, value: unknown) => {
    const next = structuredClone(m) as any;
    const keys = path.split(".");
    let obj = next;
    for (const k of keys.slice(0, -1)) obj = obj[k];
    obj[keys.at(-1)!] = value;
    onChange(next);
  };
  const get = (path: string) =>
    path.split(".").reduce((v, k) => v[k], m as any);
  const num = (
    path: string,
    label: string,
    unit?: string,
    min = 0,
    max = 10000,
  ) => (
    <Numeric
      key={path}
      label={label}
      value={get(path)}
      unit={unit}
      min={min}
      max={max}
      onChange={(v) => set(path, v)}
    />
  );
  const choice = (
    path: string,
    label: string,
    options: (string | { value: string; label: string })[],
  ) => (
    <Choice
      key={path}
      label={label}
      value={String(get(path))}
      options={options}
      onChange={(v) => set(path, typeof get(path) === "number" ? Number(v) : v)}
    />
  );
  const diameter = (path: string, label: string) =>
    choice(
      path,
      label,
      (path.endsWith("phi_t_mm") ? [6, ...diameters] : diameters).map((v) => ({
        value: String(v),
        label: `HA ${v}`,
      })),
    );
  const toggle = (path: string, label: string) => (
    <Toggle label={label} checked={get(path)} onChange={(v) => set(path, v)} />
  );
  if (tab === "materials")
    return (
      <div className="form-stack">
        <Group title="Résistances caractéristiques">
          <FormGrid>
            {num("materials.fck", "Béton fck", "MPa", 12, 50)}
            {choice(
              "materials.fyk",
              "Acier fyk",
              [400, 500, 600].map((v) => ({
                value: String(v),
                label: `S${v}`,
              })),
            )}
          </FormGrid>
          <p className="hint">
            Situation durable : γc = 1,50 · γs = 1,15 · αcc = 1. Béton jusqu’à
            C50/60.
          </p>
        </Group>
        {m.kind === "rc-column" ? (
          <Group title="Fluage">
            {num(
              "materials.phi_inf_t0",
              "Coefficient final φ(∞,t₀)",
              undefined,
              0,
              10,
            )}
            <p className="hint">
              Le fluage effectif est déduit de la combinaison quasi permanente
              et du moment ELU.
            </p>
          </Group>
        ) : (
          <>
            <Group title="Comportement de l’acier">
              <FormGrid>
                {choice("materials.steelClass", "Ductilité", ["A", "B", "C"])}
                {choice("materials.diagram", "Diagramme", [
                  { value: "horizontal", label: "Palier horizontal" },
                  { value: "inclined", label: "Palier incliné — S500" },
                ])}
              </FormGrid>
            </Group>
            <Group title="Vérifications de service">
              <FormGrid>
                {choice("materials.exposure", "Exposition", [
                  "X0",
                  "XC1",
                  "XC2",
                  "XC3",
                  "XC4",
                  "XD1",
                  "XD2",
                  "XD3",
                  "XS1",
                  "XS2",
                  "XS3",
                  "XF1",
                  "XF2",
                  "XF3",
                  "XF4",
                  "XA1",
                  "XA2",
                  "XA3",
                ])}
                {num(
                  "materials.alpha_e",
                  "Coefficient d’équivalence αe",
                  undefined,
                  5,
                  30,
                )}
              </FormGrid>
              {toggle(
                "materials.crack_control",
                "Prendre fct,eff = fctm pour le minimum de fissuration",
              )}
              {toggle(
                "serviceChecks",
                "Vérifier les contraintes ELS caractéristiques",
              )}
              <p className="hint">
                Les profils XD, XF et XS sont ici limités à S500. L’ouverture
                des fissures et la flèche différée ne sont pas calculées.
                L’exposition ne détermine pas automatiquement l’enrobage de
                durabilité.
              </p>
            </Group>
          </>
        )}
      </div>
    );
  if (tab === "geometry")
    return (
      <div className="form-stack">
        {m.kind === "rc-column" ? (
          <>
            <Group title="Section du poteau">
              <div
                className="profile-picker"
                role="group"
                aria-label="Forme de la section du poteau"
              >
                <IconButton
                  type="button"
                  label="Section rectangulaire"
                  aria-pressed={m.section.type === "rect"}
                  variant={m.section.type === "rect" ? "secondary" : "ghost"}
                  onClick={() => set("section.type", "rect")}
                >
                  <ProfileIcon shape="rect" />
                </IconButton>
                <IconButton
                  type="button"
                  label="Section circulaire — compression centrée"
                  aria-pressed={m.section.type === "circ"}
                  variant={m.section.type === "circ" ? "secondary" : "ghost"}
                  onClick={() => set("section.type", "circ")}
                >
                  <ProfileIcon shape="circle" />
                </IconButton>
              </div>
              <SectionSketch
                value={{
                  shape: m.section.type === "circ" ? "circle" : "rect",
                  b:
                    m.section.type === "circ" ? m.section.a_cm : m.section.b_cm,
                  h: m.section.h_cm,
                }}
              />
              <FormGrid>
                {m.section.type === "rect" ? (
                  <>
                    {num("section.b_cm", "Largeur b", "cm", 10, 300)}
                    {num("section.h_cm", "Hauteur h — plan y", "cm", 10, 300)}
                  </>
                ) : (
                  num("section.a_cm", "Diamètre a", "cm", 10, 300)
                )}
                {num("geometry.l_m", "Hauteur libre l", "m", 0.3, 100)}
              </FormGrid>
            </Group>
            <Group title="Longueurs de flambement">
              {choice("geometry.effective", "Définition de l₀", [
                { value: "end", label: "Liaisons classiques" },
                { value: "lengths", label: "Longueurs imposées par plan" },
                { value: "frame", label: "Souplesses du portique contreventé" },
              ])}
              {m.geometry.effective === "end" ? (
                choice("geometry.end_conditions", "Liaisons", [
                  { value: "articule_articule", label: "Articulé – articulé" },
                  { value: "encastre_articule", label: "Encastré – articulé" },
                  { value: "encastre_encastre", label: "Encastré – encastré" },
                  { value: "encastre_libre", label: "Encastré – libre" },
                  { value: "encastre_guide", label: "Encastré – guidé" },
                ])
              ) : m.geometry.effective === "lengths" ? (
                <FormGrid>
                  {num("geometry.l0y_m", "l₀ dans le plan y", "m", 0.01, 200)}
                  {num("geometry.l0z_m", "l₀ dans le plan z", "m", 0.01, 200)}
                </FormGrid>
              ) : (
                <>
                  <FormGrid>
                    {num("geometry.k1", "Souplesse k₁", undefined, 0.1, 100)}
                    {num("geometry.k2", "Souplesse k₂", undefined, 0.1, 100)}
                  </FormGrid>
                  <p className="hint">
                    k = 0,10 suppose des poutres très rigides. Confirmez cette
                    hypothèse pour votre portique.
                  </p>
                </>
              )}
              {toggle("geometry.braced", "Structure contreventée")}
              {choice("geometry.static_scheme", "Schéma transversal", [
                { value: "simple", label: "Poteau entre deux appuis" },
                { value: "console", label: "Console encastrée en pied" },
              ])}
            </Group>
          </>
        ) : (
          <>
            <Group title="Section constante">
              <div
                className="profile-picker"
                role="group"
                aria-label="Forme de la section de poutre"
              >
                <IconButton
                  type="button"
                  label="Section rectangulaire"
                  aria-pressed={m.section.type === "rect"}
                  variant={m.section.type === "rect" ? "secondary" : "ghost"}
                  onClick={() => set("section.type", "rect")}
                >
                  <ProfileIcon shape="rect" />
                </IconButton>
                <IconButton
                  type="button"
                  label="Section en T"
                  aria-pressed={m.section.type === "t"}
                  variant={m.section.type === "t" ? "secondary" : "ghost"}
                  onClick={() => set("section.type", "t")}
                >
                  <ProfileIcon shape="T" />
                </IconButton>
              </div>
              <SectionSketch
                value={{
                  shape: m.section.type === "t" ? "T" : "rect",
                  b:
                    m.section.type === "t"
                      ? m.section.beff_cm
                      : m.section.bw_cm,
                  h: m.section.h_cm,
                  tw: m.section.bw_cm,
                  tf: m.section.hf_cm,
                }}
              />
              <FormGrid>
                {num("section.bw_cm", "Largeur de l’âme bw", "cm", 10, 200)}
                {num("section.h_cm", "Hauteur totale h", "cm", 15, 300)}
                {m.section.type === "t" && (
                  <>
                    {num(
                      "section.beff_cm",
                      "Largeur efficace beff",
                      "cm",
                      10,
                      1000,
                    )}
                    {num(
                      "section.hf_cm",
                      "Épaisseur du hourdis hf",
                      "cm",
                      3,
                      100,
                    )}
                  </>
                )}
              </FormGrid>
              <p className="hint">
                beff est une largeur efficace à justifier suivant EC2 5.3.2.1,
                et non la largeur totale du plancher.
              </p>
            </Group>
            <Group title="Hauteur utile">
              {choice("section.depthMode", "Calcul de d", [
                { value: "auto", label: "Automatique — lits réels" },
                { value: "manual", label: "Valeur initiale imposée" },
              ])}
              {m.section.depthMode === "manual" &&
                num("section.d_cm", "Hauteur utile initiale d", "cm", 1, 300)}
              <p className="hint">
                Le moteur diminue d si le centre de gravité des lits
                effectivement retenus l’exige.
              </p>
            </Group>
            <Group title="Travées et appuis">
              <p className="hint">
                Les longueurs sont mesurées entre nus. La portée efficace inclut
                les débords EC2 aux appuis.
              </p>
              {m.spans.map((s, i) => (
                <div className="rc-edit-row" key={s.id}>
                  <div className="rc-row-heading">
                    <h4>{s.name}</h4>
                    <IconButton
                      type="button"
                      label={`Supprimer la travée ${i + 1}`}
                      disabled={m.spans.length === 1}
                      onClick={() => {
                        const next = structuredClone(m);
                        next.spans.splice(i, 1);
                        next.supports.splice(i + 1, 1);
                        onChange(next);
                      }}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                  <FormGrid>
                    {num(
                      `spans.${i}.ln_m`,
                      `Portée nue L${i + 1}`,
                      "m",
                      0.2,
                      50,
                    )}
                    {num(
                      `supports.${i}.width_m`,
                      `Largeur appui ${i + 1}`,
                      "m",
                      0.05,
                      3,
                    )}
                  </FormGrid>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={m.spans.length >= 8}
                onClick={() => {
                  const next = structuredClone(m);
                  next.spans.push({
                    ...next.spans.at(-1)!,
                    id: uid(),
                    name: `Travée ${next.spans.length + 1}`,
                  });
                  next.supports.push({
                    id: uid(),
                    width_m: 0.3,
                    condition: "simple",
                  });
                  onChange(next);
                }}
              >
                <Plus />
                Ajouter une travée
              </Button>
              {num(
                `supports.${m.spans.length}.width_m`,
                "Largeur du dernier appui",
                "m",
                0.05,
                3,
              )}
              <FormGrid>
                {choice("supports.0.condition", "Appui d’origine", [
                  { value: "simple", label: "Simple" },
                  { value: "fixed", label: "Encastré" },
                ])}
                {choice(
                  `supports.${m.spans.length}.condition`,
                  "Appui d’extrémité",
                  [
                    { value: "simple", label: "Simple" },
                    { value: "fixed", label: "Encastré" },
                  ],
                )}
              </FormGrid>
            </Group>
          </>
        )}
        {m.sectionTypes.filter(
          (s) =>
            s.kind === (m.kind === "rc-column" ? "column" : "beam") &&
            (!s.shape || s.shape === "rect"),
        ).length > 0 && (
          <Group title="Dimensions types de cette étude">
            <Choice
              label="Appliquer une section"
              value=""
              options={m.sectionTypes
                .filter(
                  (s) =>
                    s.kind === (m.kind === "rc-column" ? "column" : "beam") &&
                    (!s.shape || s.shape === "rect"),
                )
                .map((s) => ({ value: s.id, label: s.name }))}
              onChange={(id) => {
                const s = m.sectionTypes.find((s) => s.id === id)!;
                const n = structuredClone(m);
                if (n.kind === "rc-column")
                  Object.assign(n.section, {
                    type: "rect",
                    b_cm: s.b,
                    h_cm: s.h,
                  });
                else
                  Object.assign(n.section, {
                    type: "rect",
                    bw_cm: s.b,
                    h_cm: s.h,
                  });
                onChange(n);
              }}
            />
          </Group>
        )}
      </div>
    );
  if (tab === "loads")
    return (
      <div className="form-stack">
        {m.kind === "rc-column" ? (
          <>
            <Group title="Origine des sollicitations">
              {choice("loads.mode", "Saisie", [
                {
                  value: "actions",
                  label: "Actions caractéristiques — combinaisons automatiques",
                },
                { value: "direct", label: "Efforts de calcul ELU imposés" },
              ])}
              {toggle(
                "loads.self_weight",
                m.loads.mode === "direct"
                  ? "Ajouter le poids propre au NEd fourni en tête"
                  : "Inclure le poids propre du poteau",
              )}
              <p className="hint">
                Compression positive. Les moments sont algébriques, en kN·m. Le
                poids propre est ajouté une seule fois.
              </p>
            </Group>
            {m.loads.mode === "direct" ? (
              <Group title="Efforts imposés">
                {num(
                  "loads.direct.NEd_kN",
                  "Effort normal NEd",
                  "kN",
                  0.01,
                  1e6,
                )}
                {["y", "z"].map((p) => (
                  <Group key={p} title={`Plan ${p}`}>
                    <FormGrid>
                      {num(
                        `loads.direct.${p}.M_top_kNm`,
                        `Moment en tête ${p}`,
                        "kN·m",
                        -1e6,
                        1e6,
                      )}
                      {num(
                        `loads.direct.${p}.M_bottom_kNm`,
                        `Moment en pied ${p}`,
                        "kN·m",
                        -1e6,
                        1e6,
                      )}
                      {num(
                        `loads.direct.${p}.M_mid_kNm`,
                        `Moment intermédiaire ${p} (0 : absent)`,
                        "kN·m",
                        -1e6,
                        1e6,
                      )}
                    </FormGrid>
                  </Group>
                ))}
                {toggle(
                  "loads.direct.qp_enabled",
                  "Définir la combinaison quasi permanente pour le fluage",
                )}
                {m.loads.direct.qp_enabled && (
                  <>
                    {num(
                      "loads.direct.qp.N_kN",
                      "N quasi permanent",
                      "kN",
                      0,
                      1e6,
                    )}
                    {["y", "z"].map((p) => (
                      <FormGrid key={p}>
                        {num(
                          `loads.direct.qp.${p}.M_top_kNm`,
                          `M quasi permanent tête ${p}`,
                          "kN·m",
                          -1e6,
                          1e6,
                        )}
                        {num(
                          `loads.direct.qp.${p}.M_bottom_kNm`,
                          `M quasi permanent pied ${p}`,
                          "kN·m",
                          -1e6,
                          1e6,
                        )}
                      </FormGrid>
                    ))}
                  </>
                )}
              </Group>
            ) : (
              <Group title="Actions caractéristiques">
                {m.loads.actions.map((a, i) => (
                  <ActionEditor
                    key={a.id}
                    action={a}
                    height={m.geometry.l_m}
                    index={i}
                    onChange={(v) => set(`loads.actions.${i}`, v)}
                    onDuplicate={() =>
                      set("loads.actions", [
                        ...m.loads.actions,
                        {
                          ...structuredClone(a),
                          id: uid(),
                          name: `${a.name} (copie)`,
                        },
                      ])
                    }
                    onRemove={() =>
                      set(
                        "loads.actions",
                        m.loads.actions.filter((v) => v.id !== a.id),
                      )
                    }
                    removable={m.loads.actions.length > 1}
                    duplicable={m.loads.actions.length < 12}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={m.loads.actions.length >= 12}
                  onClick={() =>
                    set("loads.actions", [...m.loads.actions, newRCAction("Q")])
                  }
                >
                  <Plus />
                  Ajouter une action
                </Button>
              </Group>
            )}
          </>
        ) : (
          <>
            <Group title="Charges réparties caractéristiques">
              {toggle("selfWeight", "Inclure le poids propre — 25 kN/m³")}
              {m.spans.map((s, i) => (
                <Group key={s.id} title={s.name}>
                  <FormGrid>
                    {num(
                      `spans.${i}.g_kN_m`,
                      `Charge G — travée ${i + 1}`,
                      "kN/m",
                      0,
                      10000,
                    )}
                    {num(
                      `spans.${i}.q_kN_m`,
                      `Charge Q — travée ${i + 1}`,
                      "kN/m",
                      0,
                      10000,
                    )}
                  </FormGrid>
                </Group>
              ))}
              <p className="hint">
                ELU : 1,35G + 1,50Q. ELS caractéristique : G + Q. Charges
                descendantes uniformes sur chaque travée.
              </p>
              {toggle(
                "analysis.patterned",
                "Envelopper toutes les dispositions de Q (damiers)",
              )}
            </Group>
          </>
        )}
      </div>
    );
  if (tab === "detailing")
    return (
      <div className="form-stack">
        <Group title="Enrobage et mise en place">
          <FormGrid>
            {num("detailing.cnom_mm", "Enrobage nominal cnom", "mm", 10, 150)}
            {num("detailing.coverDev_mm", "Tolérance Δcdev", "mm", 0, 20)}
            {num("detailing.dg_mm", "Granulat maximal dg", "mm", 5, 60)}
            {diameter("detailing.phi_t_mm", "Diamètre transversal")}
          </FormGrid>
          <p className="hint">
            L’enrobage doit aussi satisfaire la durabilité et le feu. Le
            contrôle automatique couvre la liaison et la tolérance saisie.
          </p>
        </Group>
        {m.kind === "rc-column" ? (
          <>
            <Group title="Armatures longitudinales">
              {choice("detailing.mode", "Objectif", [
                {
                  value: "design",
                  label: "Proposer un ferraillage symétrique",
                },
                { value: "verify", label: "Vérifier un ferraillage imposé" },
              ])}
              {m.detailing.mode === "design" ? (
                <FormGrid>
                  {diameter("detailing.phi_l_min_mm", "Diamètre minimal")}
                  {diameter("detailing.phi_l_max_mm", "Diamètre maximal")}
                </FormGrid>
              ) : (
                <>
                  <FormGrid>
                    {diameter("detailing.bars.phi", "Diamètre des angles")}
                    {m.section.type === "circ" ? (
                      num(
                        "detailing.bars.n",
                        "Nombre de barres",
                        undefined,
                        4,
                        40,
                      )
                    ) : (
                      <>
                        {diameter(
                          "detailing.bars.phi_i",
                          "Diamètre intermédiaire",
                        )}
                        {num(
                          "detailing.bars.k",
                          "Barres par face de largeur b (angles inclus)",
                          undefined,
                          2,
                          20,
                        )}
                        {num(
                          "detailing.bars.m",
                          "Barres intermédiaires par face de hauteur h",
                          undefined,
                          0,
                          20,
                        )}
                      </>
                    )}
                  </FormGrid>
                  <p className="hint">
                    Section rectangulaire : total = 2k + 2m. Le ferraillage
                    reste symétrique.
                  </p>
                </>
              )}
            </Group>
            <Group title="Recouvrements">
              {toggle("detailing.lap", "Dimensionner les recouvrements")}
              {m.detailing.lap && (
                <>
                  {num(
                    "detailing.rho1",
                    "Proportion recouverte ρ₁",
                    "%",
                    1,
                    100,
                  )}
                  {toggle(
                    "detailing.good_bond",
                    "Bonnes conditions d’adhérence",
                  )}
                  {toggle(
                    "detailing.welded",
                    "Armatures transversales soudées",
                  )}
                </>
              )}
            </Group>
          </>
        ) : (
          <>
            <Group title="Nappes longitudinales">
              <FormGrid>
                {diameter("detailing.phi_l_mm", "Diamètre longitudinal")}
                {choice(
                  "detailing.branches",
                  "Brins du cadre",
                  [2, 4, 6, 8].map((v) => ({
                    value: String(v),
                    label: `${v} brins`,
                  })),
                )}
                {num(
                  "detailing.alpha_deg",
                  "Inclinaison des cadres α",
                  "°",
                  45,
                  90,
                )}
              </FormGrid>
              <p className="hint">
                Jusqu’à trois lits, avec calcul du centre de gravité réel. Des
                aciers comprimés sont ajoutés si nécessaire.
              </p>
            </Group>
            <Group title="Répartition transversale">
              {choice("shear.method", "Bielles", [
                { value: "variable", label: "Inclinaison variable" },
                { value: "standard", label: "Bielles à 45°" },
              ])}
              {choice("shear.distribution", "Pas des cadres", [
                {
                  value: "caquot",
                  label: "Série commerciale Caquot enveloppe",
                },
                { value: "direct", label: "Enveloppe directe — pas de 5 mm" },
              ])}
              <p className="hint">
                Les pas sont arrondis vers le bas. Le tracé d’armatures est un
                schéma de principe à compléter par un plan d’exécution.
              </p>
            </Group>
          </>
        )}
      </div>
    );
  return (
    <div className="form-stack">
      {m.kind === "rc-column" ? (
        <>
          <Group title="Cascade de dimensionnement">
            <ol className="rc-method-list">
              <li>
                Compression conventionnelle et contrôle strict de l’élancement
              </li>
              <li>
                Flexion composée au premier ordre, excentricité minimale incluse
              </li>
              <li>
                Second ordre si nécessaire, puis vérification du ferraillage
                réel
              </li>
            </ol>
            {choice("options.second_order_method", "Méthode de second ordre", [
              { value: "courbure", label: "Courbure nominale" },
              { value: "rigidite", label: "Rigidité nominale" },
            ])}
            <FormGrid>
              {num(
                m.options.second_order_method === "courbure"
                  ? "options.c_curvature"
                  : "options.c0",
                "Coefficient de distribution des moments",
                undefined,
                4,
                20,
              )}
              {num(
                "geometry.l_total_m",
                "Hauteur totale — imperfections",
                "m",
                0.3,
                200,
              )}
              {num(
                "geometry.m_elements",
                "Nombre d’éléments — imperfections",
                undefined,
                1,
                1000,
              )}
            </FormGrid>
            <p className="hint">
              La méthode générale et les portiques déplaçables ne sont pas
              résolus. Les longueurs efficaces imposées ne remplacent pas une
              analyse globale de stabilité.
            </p>
          </Group>
        </>
      ) : (
        <>
          <Group title="Construction et analyse">
            {choice(
              "analysis.construction",
              "Liaison de la poutre aux appuis",
              [
                { value: "unspecified", label: "À préciser avant de calculer" },
                { value: "posed", label: "Poutre posée" },
                { value: "monolithic", label: "Poutre solidaire des appuis" },
              ],
            )}
            {choice("analysis.method", "Analyse", [
              {
                value: "elastic",
                label: "Élastique — théorème des trois moments",
              },
              { value: "plastic", label: "Plastique — équilibre et ductilité" },
              { value: "compare", label: "Comparer élastique et plastique" },
            ])}
            {m.analysis.method === "compare" &&
              choice("analysis.reference", "Ferraillage retenu", [
                { value: "elastic", label: "Enveloppe élastique" },
                { value: "plastic", label: "Équilibre plastique" },
              ])}
            <p className="hint">
              L’analyse plastique suppose le chargement intégral. Ses critères
              de ductilité sont vérifiés ; les damiers restent à traiter en
              analyse élastique.
            </p>
          </Group>
          <Group title="Redistribution élastique">
            {toggle(
              "analysis.redistribution",
              "Autoriser la redistribution limitée des moments ELU",
            )}
            {m.analysis.redistribution &&
              num(
                "analysis.delta",
                "Rapport minimal δ = Mredistribué / Mélastique",
                undefined,
                0.7,
                1,
              )}
            <p className="hint">
              Les critères EC2 5.5 et les maxima en travée limitent la
              réduction. L’ELS n’est pas redistribué.
            </p>
          </Group>
          <Group title="Dispositions d’appui">
            {num(
              "analysis.beta2",
              "Fraction d’acier inférieur β₂ à ancrer",
              undefined,
              0,
              0.5,
            )}
            {m.section.type === "t" &&
              choice("analysis.flange_joint", "Jonction hourdis–nervure", [
                { value: "monolithic", label: "Monolithique" },
                {
                  value: "rough",
                  label: "Reprise rugueuse — coefficient réduit",
                },
              ])}
          </Group>
        </>
      )}
      <Group title="Profil normatif">
        <p className="hint">
          EC2 EN 1992-1-1 de première génération. Les coefficients utilisés
          figurent dans les résultats et dans la note. Ce module ne couvre pas
          une vérification réglementaire complète de l’ouvrage.
        </p>
      </Group>
    </div>
  );
}
function ActionEditor({
  action: a,
  onChange,
  height,
  index,
  onDuplicate,
  onRemove,
  removable,
  duplicable,
}: {
  action: RCAction;
  onChange: (a: RCAction) => void;
  height: number;
  index: number;
  onDuplicate: () => void;
  onRemove: () => void;
  removable: boolean;
  duplicable: boolean;
}) {
  const change = (v: Partial<RCAction>) => onChange({ ...a, ...v });
  const plane = (p: "y" | "z") => (
    <Group title={`Moments — plan ${p}`} key={p}>
      <FormGrid>
        {(["top", "bottom"] as const).map((k) => (
          <Numeric
            key={k}
            label={`${k === "top" ? "Tête" : "Pied"} ${p} — action ${index + 1}`}
            value={a.moments[p][k]}
            unit="kN·m"
            min={-1e6}
            max={1e6}
            onChange={(v) =>
              change({
                moments: { ...a.moments, [p]: { ...a.moments[p], [k]: v } },
              })
            }
          />
        ))}
        <Numeric
          label={`Excentricité ${p} — action ${index + 1}`}
          value={a.eccentricity_m[p]}
          min={-10}
          max={10}
          unit="m"
          onChange={(v) =>
            change({ eccentricity_m: { ...a.eccentricity_m, [p]: v } })
          }
        />
      </FormGrid>
    </Group>
  );
  return (
    <div className="rc-edit-row">
      <div className="rc-row-heading">
        <h4>{a.name}</h4>
        <div>
          <IconButton
            type="button"
            label={`Dupliquer l’action ${index + 1}`}
            onClick={onDuplicate}
            disabled={!duplicable}
          >
            <Copy />
          </IconButton>
          <IconButton
            type="button"
            label={`Supprimer l’action ${index + 1}`}
            onClick={onRemove}
            disabled={!removable}
          >
            <Trash2 />
          </IconButton>
        </div>
      </div>
      <label className="field">
        Nom de l’action
        <Input
          aria-label={`Nom de l’action ${index + 1}`}
          value={a.name}
          maxLength={100}
          onChange={(e) => change({ name: e.target.value })}
        />
      </label>
      <FormGrid>
        <Choice
          label={`Nature — action ${index + 1}`}
          value={a.category}
          options={["G", "Q", "W", "S", "T"]}
          onChange={(v) => change({ category: v as RCAction["category"] })}
        />
        <Numeric
          label={`Effort normal — action ${index + 1}`}
          value={a.N_kN}
          unit="kN"
          min={-1e6}
          max={1e6}
          onChange={(N_kN) => change({ N_kN })}
        />
        {a.category !== "G" && (
          <>
            <Numeric
              label={`ψ₀ — action ${index + 1}`}
              value={a.psi0}
              min={0}
              max={1}
              onChange={(psi0) => change({ psi0 })}
            />
            <Numeric
              label={`ψ₂ — action ${index + 1}`}
              value={a.psi2}
              min={0}
              max={1}
              onChange={(psi2) => change({ psi2 })}
            />
          </>
        )}
      </FormGrid>
      <Disclosure
        title={`Moments, excentricités et charges locales — ${a.name}`}
      >
        {plane("y")}
        {plane("z")}
        <p className="hint">
          z est la distance depuis le pied du poteau. Les efforts locaux
          s’ajoutent aux moments de tête et de pied.
        </p>
        {a.axial.map((v, j) => (
          <div className="rc-edit-row" key={v.id}>
            <FormGrid>
              <Numeric
                label={`N local ${j + 1}`}
                value={v.N_kN}
                unit="kN"
                min={-1e6}
                max={1e6}
                onChange={(n) =>
                  change({
                    axial: a.axial.map((t) =>
                      t.id === v.id ? { ...t, N_kN: n } : t,
                    ),
                  })
                }
              />
              <Numeric
                label={`z axial ${j + 1}`}
                value={v.z_m}
                unit="m"
                max={height}
                onChange={(n) =>
                  change({
                    axial: a.axial.map((t) =>
                      t.id === v.id ? { ...t, z_m: n } : t,
                    ),
                  })
                }
              />
            </FormGrid>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                change({ axial: a.axial.filter((t) => t.id !== v.id) })
              }
            >
              Retirer cette charge axiale
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={a.axial.length >= 30}
          onClick={() =>
            change({
              axial: [...a.axial, { id: uid(), z_m: height / 2, N_kN: 0 }],
            })
          }
        >
          <Plus />
          Charge axiale intermédiaire
        </Button>
        {a.transverse.map((v, j) => (
          <div className="rc-edit-row" key={v.id}>
            <FormGrid>
              <Choice
                label={`Plan transversal ${j + 1}`}
                value={v.plane}
                options={["y", "z"]}
                onChange={(n) =>
                  change({
                    transverse: a.transverse.map((t) =>
                      t.id === v.id ? { ...t, plane: n as "y" | "z" } : t,
                    ),
                  })
                }
              />
              <Choice
                label={`Type transversal ${j + 1}`}
                value={v.type}
                options={[
                  { value: "point", label: "Ponctuelle" },
                  { value: "uniform", label: "Uniforme sur la hauteur" },
                ]}
                onChange={(n) =>
                  change({
                    transverse: a.transverse.map((t) =>
                      t.id === v.id
                        ? { ...t, type: n as "point" | "uniform" }
                        : t,
                    ),
                  })
                }
              />
              <Numeric
                label={`Intensité transversale ${j + 1}`}
                value={v.type === "point" ? v.F_kN : v.q_kN_m}
                unit={v.type === "point" ? "kN" : "kN/m"}
                min={-1e5}
                max={1e5}
                onChange={(n) =>
                  change({
                    transverse: a.transverse.map((t) =>
                      t.id === v.id
                        ? { ...t, [v.type === "point" ? "F_kN" : "q_kN_m"]: n }
                        : t,
                    ),
                  })
                }
              />
              {v.type === "point" && (
                <Numeric
                  label={`z transversal ${j + 1}`}
                  value={v.z_m}
                  unit="m"
                  max={height}
                  onChange={(n) =>
                    change({
                      transverse: a.transverse.map((t) =>
                        t.id === v.id ? { ...t, z_m: n } : t,
                      ),
                    })
                  }
                />
              )}
            </FormGrid>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                change({
                  transverse: a.transverse.filter((t) => t.id !== v.id),
                })
              }
            >
              Retirer cette charge transversale
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={a.transverse.length >= 30}
          onClick={() =>
            change({
              transverse: [
                ...a.transverse,
                {
                  id: uid(),
                  plane: "y",
                  type: "point",
                  z_m: height / 2,
                  F_kN: 0,
                  q_kN_m: 0,
                },
              ],
            })
          }
        >
          <Plus />
          Charge transversale
        </Button>
      </Disclosure>
    </div>
  );
}
