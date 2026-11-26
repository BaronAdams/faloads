import { z } from "zod";
import { sectionTypesSchema, sectionCatalogue } from "../section-types";
import { uid } from "@/lib/utils";
const f = z.number().finite();
const positive = f.positive();
const barDiameter = z.union([
  z.literal(8),
  z.literal(10),
  z.literal(12),
  z.literal(14),
  z.literal(16),
  z.literal(20),
  z.literal(25),
  z.literal(32),
]);
const transverseDiameter = z.union([z.literal(6), barDiameter]);
const endCondition = z.enum([
  "articule_articule",
  "encastre_articule",
  "encastre_encastre",
  "encastre_libre",
  "encastre_guide",
]);
const moments = z.object({
  top: f.min(-1e6).max(1e6),
  bottom: f.min(-1e6).max(1e6),
});
const action = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  category: z.enum(["G", "Q", "W", "S", "T"]),
  N_kN: f.min(-1e6).max(1e6),
  psi0: f.min(0).max(1),
  psi2: f.min(0).max(1),
  moments: z.object({ y: moments, z: moments }),
  eccentricity_m: z.object({ y: f.min(-10).max(10), z: f.min(-10).max(10) }),
  axial: z
    .array(
      z.object({
        id: z.string(),
        z_m: f.min(0).max(100),
        N_kN: f.min(-1e6).max(1e6),
      }),
    )
    .max(30),
  transverse: z
    .array(
      z.object({
        id: z.string(),
        plane: z.enum(["y", "z"]),
        type: z.enum(["point", "uniform"]),
        z_m: f.min(0).max(100),
        F_kN: f.min(-1e5).max(1e5),
        q_kN_m: f.min(-1e5).max(1e5),
      }),
    )
    .max(30),
});
const common = {
  version: z.literal(1),
  sectionTypes: sectionTypesSchema,
  legacy: z
    .object({ source: z.unknown(), reviewed: z.boolean(), code: z.string() })
    .optional(),
};
export const rcColumnSchema = z
  .object({
    ...common,
    kind: z.literal("rc-column"),
    section: z.object({
      type: z.enum(["rect", "circ"]),
      b_cm: positive.min(10).max(300),
      h_cm: positive.min(10).max(300),
      a_cm: positive.min(10).max(300),
    }),
    geometry: z.object({
      l_m: positive.min(0.3).max(100),
      braced: z.boolean(),
      static_scheme: z.enum(["simple", "console"]),
      effective: z.enum(["end", "lengths", "frame"]),
      end_conditions: endCondition,
      l0y_m: positive.max(200),
      l0z_m: positive.max(200),
      k1: positive.min(0.1).max(100),
      k2: positive.min(0.1).max(100),
      l_total_m: positive.max(200),
      m_elements: z.number().int().min(1).max(1000),
    }),
    materials: z.object({
      fck: f.min(12).max(50),
      fyk: z.union([z.literal(400), z.literal(500), z.literal(600)]),
      phi_inf_t0: f.min(0).max(10),
    }),
    detailing: z.object({
      cnom_mm: f.min(10).max(150),
      coverDev_mm: f.min(0).max(20),
      phi_t_mm: transverseDiameter,
      phi_l_min_mm: barDiameter,
      phi_l_max_mm: barDiameter,
      dg_mm: f.min(5).max(60),
      lap: z.boolean(),
      rho1: f.min(1).max(100),
      good_bond: z.boolean(),
      welded: z.boolean(),
      mode: z.enum(["design", "verify"]),
      bars: z.object({
        phi: barDiameter,
        phi_i: barDiameter,
        k: z.number().int().min(2).max(20),
        m: z.number().int().min(0).max(20),
        n: z.number().int().min(4).max(40),
      }),
    }),
    loads: z.object({
      mode: z.enum(["actions", "direct"]),
      self_weight: z.boolean(),
      actions: z.array(action).min(1).max(12),
      direct: z.object({
        NEd_kN: positive.max(1e6),
        y: z.object({ M_top_kNm: f, M_bottom_kNm: f, M_mid_kNm: f }),
        z: z.object({ M_top_kNm: f, M_bottom_kNm: f, M_mid_kNm: f }),
        qp_enabled: z.boolean(),
        qp: z.object({
          N_kN: f.min(0).max(1e6),
          y: z.object({ M_top_kNm: f, M_bottom_kNm: f }),
          z: z.object({ M_top_kNm: f, M_bottom_kNm: f }),
        }),
      }),
    }),
    options: z.object({
      second_order_method: z.enum(["courbure", "rigidite"]),
      c_curvature: positive.min(4).max(20),
      c0: positive.min(4).max(20),
      n_bal: f.min(0.1).max(0.9),
    }),
  })
  .superRefine((m, ctx) => {
    if (m.detailing.phi_l_min_mm > m.detailing.phi_l_max_mm)
      ctx.addIssue({
        code: "custom",
        message: "Le diamètre minimal dépasse le diamètre maximal.",
      });
    if (m.geometry.effective === "frame" && !m.geometry.braced)
      ctx.addIssue({
        code: "custom",
        message:
          "Portique non contreventé : fournissez les longueurs efficaces dans les deux plans.",
      });
    if (
      m.loads.actions.some(
        (a) =>
          a.axial.some((v) => v.z_m > m.geometry.l_m) ||
          a.transverse.some(
            (v) => v.type === "point" && v.z_m > m.geometry.l_m,
          ),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Une charge est placée au-delà de la hauteur du poteau.",
      });
  });
export const rcBeamSchema = z
  .object({
    ...common,
    kind: z.literal("rc-beam"),
    section: z.object({
      type: z.enum(["rect", "t"]),
      bw_cm: positive.min(10).max(200),
      h_cm: positive.min(15).max(300),
      beff_cm: positive.min(10).max(1000),
      hf_cm: positive.min(3).max(100),
      depthMode: z.enum(["auto", "manual"]),
      d_cm: positive.max(300),
    }),
    materials: z.object({
      fck: f.min(12).max(50),
      fyk: z.union([z.literal(400), z.literal(500), z.literal(600)]),
      steelClass: z.enum(["A", "B", "C"]),
      diagram: z.enum(["horizontal", "inclined"]),
      exposure: z.enum([
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
      ]),
      alpha_e: f.min(5).max(30),
      crack_control: z.boolean(),
    }),
    detailing: z.object({
      cnom_mm: f.min(10).max(150),
      coverDev_mm: f.min(0).max(20),
      phi_l_mm: barDiameter,
      phi_t_mm: transverseDiameter,
      dg_mm: f.min(5).max(60),
      branches: z.union([
        z.literal(2),
        z.literal(4),
        z.literal(6),
        z.literal(8),
      ]),
      alpha_deg: f.min(45).max(90),
    }),
    spans: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(80),
          ln_m: positive.min(0.2).max(50),
          g_kN_m: f.min(0).max(10000),
          q_kN_m: f.min(0).max(10000),
        }),
      )
      .min(1)
      .max(8),
    supports: z
      .array(
        z.object({
          id: z.string(),
          width_m: positive.min(0.05).max(3),
          condition: z.enum(["simple", "fixed"]),
        }),
      )
      .min(2)
      .max(9),
    selfWeight: z.boolean(),
    serviceChecks: z.boolean(),
    analysis: z.object({
      method: z.enum(["elastic", "plastic", "compare"]),
      reference: z.enum(["elastic", "plastic"]),
      patterned: z.boolean(),
      redistribution: z.boolean(),
      delta: f.min(0.7).max(1),
      construction: z.enum(["unspecified", "posed", "monolithic"]),
      beta2: f.min(0).max(0.5),
      flange_joint: z.enum(["monolithic", "rough"]),
    }),
    shear: z.object({
      method: z.enum(["variable", "standard"]),
      distribution: z.enum(["caquot", "direct"]),
    }),
  })
  .superRefine((m, ctx) => {
    if (m.supports.length !== m.spans.length + 1)
      ctx.addIssue({
        code: "custom",
        message: "Il faut exactement n + 1 appuis pour n travées.",
      });
    if (
      m.section.type === "t" &&
      (m.section.beff_cm < m.section.bw_cm || m.section.hf_cm >= m.section.h_cm)
    )
      ctx.addIssue({
        code: "custom",
        message: "Section en T : beff ≥ bw et hf < h requis.",
      });
    if (m.section.depthMode === "manual" && m.section.d_cm >= m.section.h_cm)
      ctx.addIssue({
        code: "custom",
        message: "La hauteur utile d doit rester inférieure à h.",
      });
  });
export const rcModelSchema = z.discriminatedUnion("kind", [
  rcColumnSchema,
  rcBeamSchema,
]);
export type RCColumnModel = z.infer<typeof rcColumnSchema>;
export type RCBeamModel = z.infer<typeof rcBeamSchema>;
export type RCModel = z.infer<typeof rcModelSchema>;
export type RCAction = RCColumnModel["loads"]["actions"][number];
export const isRCModel = (data: unknown): data is RCModel =>
  !!data &&
  typeof data === "object" &&
  ["rc-column", "rc-beam"].includes((data as { kind: string }).kind);
export const newRCAction = (
  category: RCAction["category"] = "G",
): RCAction => ({
  id: uid(),
  name:
    category === "G"
      ? "Charges permanentes"
      : category === "Q"
        ? "Exploitation"
        : "Vent",
  category,
  N_kN: category === "G" ? 400 : category === "Q" ? 250 : 0,
  psi0: category === "W" ? 0.6 : 0.7,
  psi2: category === "Q" ? 0.3 : 0,
  moments: { y: { top: 0, bottom: 0 }, z: { top: 0, bottom: 0 } },
  eccentricity_m: { y: 0, z: 0 },
  axial: [],
  transverse: [],
});
export function rcColumnDefaults(fck = 25): RCColumnModel {
  return {
    kind: "rc-column",
    version: 1,
    sectionTypes: sectionCatalogue(),
    section: { type: "rect", b_cm: 40, h_cm: 40, a_cm: 40 },
    geometry: {
      l_m: 3,
      braced: true,
      static_scheme: "simple",
      effective: "end",
      end_conditions: "articule_articule",
      l0y_m: 3,
      l0z_m: 3,
      k1: 0.1,
      k2: 0.1,
      l_total_m: 3,
      m_elements: 1,
    },
    materials: { fck, fyk: 500, phi_inf_t0: 2 },
    detailing: {
      cnom_mm: 35,
      coverDev_mm: 10,
      phi_t_mm: 8,
      phi_l_min_mm: 12,
      phi_l_max_mm: 32,
      dg_mm: 20,
      lap: true,
      rho1: 100,
      good_bond: true,
      welded: false,
      mode: "design",
      bars: { phi: 20, phi_i: 20, k: 2, m: 0, n: 6 },
    },
    loads: {
      mode: "actions",
      self_weight: true,
      actions: [newRCAction("G"), newRCAction("Q")],
      direct: {
        NEd_kN: 1000,
        y: { M_top_kNm: 0, M_bottom_kNm: 0, M_mid_kNm: 0 },
        z: { M_top_kNm: 0, M_bottom_kNm: 0, M_mid_kNm: 0 },
        qp_enabled: false,
        qp: {
          N_kN: 500,
          y: { M_top_kNm: 0, M_bottom_kNm: 0 },
          z: { M_top_kNm: 0, M_bottom_kNm: 0 },
        },
      },
    },
    options: {
      second_order_method: "courbure",
      c_curvature: 10,
      c0: 8,
      n_bal: 0.4,
    },
  };
}
export function rcBeamDefaults(fck = 25): RCBeamModel {
  return {
    kind: "rc-beam",
    version: 1,
    sectionTypes: sectionCatalogue(),
    section: {
      type: "rect",
      bw_cm: 25,
      h_cm: 55,
      beff_cm: 100,
      hf_cm: 15,
      depthMode: "auto",
      d_cm: 49.5,
    },
    materials: {
      fck,
      fyk: 500,
      steelClass: "B",
      diagram: "horizontal",
      exposure: "XC1",
      alpha_e: 15,
      crack_control: false,
    },
    detailing: {
      cnom_mm: 35,
      coverDev_mm: 10,
      phi_l_mm: 16,
      phi_t_mm: 8,
      dg_mm: 20,
      branches: 2,
      alpha_deg: 90,
    },
    spans: [{ id: uid(), name: "Travée 1", ln_m: 4.5, g_kN_m: 8, q_kN_m: 5 }],
    supports: [
      { id: uid(), width_m: 0.3, condition: "simple" },
      { id: uid(), width_m: 0.3, condition: "simple" },
    ],
    selfWeight: true,
    serviceChecks: true,
    analysis: {
      method: "elastic",
      reference: "elastic",
      patterned: true,
      redistribution: false,
      delta: 0.85,
      construction: "unspecified",
      beta2: 0.25,
      flange_joint: "monolithic",
    },
    shear: { method: "variable", distribution: "caquot" },
  };
}
