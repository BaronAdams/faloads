import { useState } from "react";
import { EditorSheet } from "./editor-sheet";
import { Numeric, Choice, FormGrid, Metric, Notice } from "./common";
import { concreteClasses, quickBeam, quickFrame } from "@/domain/engineering";
export function QuickAnalysis({
  kind,
  open,
  onOpenChange,
}: {
  kind: "beam" | "frame";
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState({
      length: 5,
      height: 3,
      g: 12,
      q: 4,
      b: 25,
      h: 45,
      cb: 30,
      ch: 30,
      concrete: "C25/30",
    }),
    patch = (v: Partial<typeof data>) => setData({ ...data, ...v }),
    r =
      kind === "beam"
        ? quickBeam(data.length, data.g, data.q, data.b, data.h, data.concrete)
        : quickFrame(
            data.length,
            data.height,
            data.g,
            data.q,
            data.b,
            data.h,
            data.cb,
            data.ch,
          );
  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Calcul simplifié G/Q"
      description={
        kind === "beam"
          ? "Poutre sur deux appuis, charge uniforme."
          : "Portique symétrique, bases encastrées, charge uniforme sur la traverse."
      }
    >
      <div className="editor-fields">
        <FormGrid>
          <Numeric
            label="Portée L"
            value={data.length}
            min={0.1}
            max={1000}
            unit="m"
            onChange={(length) => patch({ length })}
          />
          {kind === "frame" && (
            <Numeric
              label="Hauteur des poteaux"
              value={data.height}
              min={0.1}
              max={100}
              unit="m"
              onChange={(height) => patch({ height })}
            />
          )}
        </FormGrid>
        <FormGrid>
          <Numeric
            label="Charge permanente G"
            value={data.g}
            unit="kN/m"
            onChange={(g) => patch({ g })}
          />
          <Numeric
            label="Exploitation Q"
            value={data.q}
            unit="kN/m"
            onChange={(q) => patch({ q })}
          />
          <Numeric
            label="Largeur de poutre b"
            value={data.b}
            min={1}
            unit="cm"
            onChange={(b) => patch({ b })}
          />
          <Numeric
            label="Hauteur de poutre h"
            value={data.h}
            min={1}
            unit="cm"
            onChange={(h) => patch({ h })}
          />
        </FormGrid>
        {kind === "beam" ? (
          <Choice
            label="Béton"
            value={data.concrete}
            options={concreteClasses}
            onChange={(concrete) => patch({ concrete })}
          />
        ) : (
          <FormGrid>
            <Numeric
              label="Poteaux · largeur b"
              value={data.cb}
              min={1}
              unit="cm"
              onChange={(cb) => patch({ cb })}
            />
            <Numeric
              label="Poteaux · hauteur h"
              value={data.ch}
              min={1}
              unit="cm"
              onChange={(ch) => patch({ ch })}
            />
          </FormGrid>
        )}
        <div className="metrics-grid">
          {"deflection" in r ? (
            <>
              <Metric label="Moment ELU" value={r.moment} unit="kN·m" />
              <Metric label="Réaction par appui" value={r.reaction} unit="kN" />
              <Metric label="Flèche ELS" value={r.deflection} unit="mm" />
              <Metric label="Limite L/250" value={r.limit} unit="mm" />
            </>
          ) : (
            <>
              <Metric label="Moment de nœud" value={r.joint} unit="kN·m" />
              <Metric label="Moment de base" value={r.base} unit="kN·m" />
              <Metric label="Moment de travée" value={r.midspan} unit="kN·m" />
              <Metric
                label="Effort horizontal par poteau"
                value={r.shear}
                unit="kN"
              />
            </>
          )}
        </div>
        <Notice>
          Fonctions G/Q conservées de la version précédente. ELU : 1,35G + 1,5Q.
          La flèche de poutre est une estimation élastique non fissurée sous G +
          Q à l’ELS.
        </Notice>
      </div>
    </EditorSheet>
  );
}
