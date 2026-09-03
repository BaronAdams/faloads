import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../theme/app_colors.dart";
import "../../widgets/number_field.dart";
import "../../widgets/result_row.dart";
import "../../widgets/struct_icon.dart";

/// Calculateur de cadres: a standalone statics tool for a symmetric
/// single-bay portal frame (poteau-poutre-poteau closing a rectangle,
/// fixed at both bases) under a UDL on the beam — solved via the
/// slope-deflection method (see domain/beam_analysis.dart for the
/// derivation). Distinct from Bâtiment complet's grid, which handles a
/// whole building rather than one isolated frame.
class FrameCalcScreen extends StatefulWidget {
  const FrameCalcScreen({super.key});

  @override
  State<FrameCalcScreen> createState() => _FrameCalcScreenState();
}

class _FrameCalcScreenState extends State<FrameCalcScreen> {
  double _spanM = 5.0;
  double _heightM = 3.0;
  double _gKnM = 10.0;
  double _qKnM = 6.0;
  double _beamBCm = 25;
  double _beamHCm = 45;
  double _columnBCm = 30;
  double _columnHCm = 30;

  PortalFrameResult get _result => analyzePortalFrameUdl(
        spanM: _spanM,
        heightM: _heightM,
        gKnM: _gKnM,
        qKnM: _qKnM,
        beamBCm: _beamBCm,
        beamHCm: _beamHCm,
        columnBCm: _columnBCm,
        columnHCm: _columnHCm,
      );

  @override
  Widget build(BuildContext context) {
    final result = _result;
    return Scaffold(
      appBar: AppBar(title: const Text("Calculateur de cadres")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          const Center(
            child: StructIcon(kind: StructIconKind.portalFrame, size: 56, annotation: StructIconAnnotation.load),
          ),
          const SizedBox(height: 4),
          Text(
            "Portique à 1 travée, appuis encastrés, charge sur la traverse",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: NumberField(label: "Portée L", unit: "m", value: _spanM, min: 0.5, onChanged: (v) => setState(() => _spanM = v)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: NumberField(
                  label: "Hauteur h",
                  unit: "m",
                  value: _heightM,
                  min: 0.5,
                  onChanged: (v) => setState(() => _heightM = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: NumberField(
                  label: "G (permanent)",
                  unit: "kN/m",
                  value: _gKnM,
                  onChanged: (v) => setState(() => _gKnM = v),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: NumberField(
                  label: "Q (exploitation)",
                  unit: "kN/m",
                  value: _qKnM,
                  onChanged: (v) => setState(() => _qKnM = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Text("Traverse (poutre)", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: NumberField(
                  label: "Section b",
                  unit: "cm",
                  value: _beamBCm,
                  min: 10,
                  onChanged: (v) => setState(() => _beamBCm = v),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: NumberField(
                  label: "Section h",
                  unit: "cm",
                  value: _beamHCm,
                  min: 10,
                  onChanged: (v) => setState(() => _beamHCm = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          const Text("Poteaux", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: NumberField(
                  label: "Section b",
                  unit: "cm",
                  value: _columnBCm,
                  min: 10,
                  onChanged: (v) => setState(() => _columnBCm = v),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: NumberField(
                  label: "Section h",
                  unit: "cm",
                  value: _columnHCm,
                  min: 10,
                  onChanged: (v) => setState(() => _columnHCm = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text("Résultats", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                ResultRow(label: "Charge ELU (w_ELU)", value: "${result.wEluKnM.toStringAsFixed(2)} kN/m"),
                ResultRow(label: "Rapport de raideur k", value: result.stiffnessRatioK.toStringAsFixed(2)),
                const Divider(height: 24),
                ResultRow(label: "Moment au nœud (M_B)", value: "${result.jointMomentKnM.toStringAsFixed(2)} kN·m"),
                ResultRow(label: "Moment en pied de poteau", value: "${result.baseMomentKnM.toStringAsFixed(2)} kN·m"),
                ResultRow(label: "Moment à mi-travée", value: "${result.beamMidspanMomentKnM.toStringAsFixed(2)} kN·m"),
                ResultRow(label: "Effort tranchant (poteau)", value: "${result.columnShearKn.toStringAsFixed(1)} kN"),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "Méthode des rotations (slope-deflection), portique symétrique sans déplacement latéral : "
            "M_B = w·L²/(12+6k), k = (I_poutre/L)/(I_poteau/h).",
            style: TextStyle(fontSize: 11, color: AppColors.textTertiary, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }
}
