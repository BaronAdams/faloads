import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../theme/app_colors.dart";
import "../../widgets/number_field.dart";
import "../../widgets/picker_field.dart";
import "../../widgets/result_row.dart";
import "../../widgets/struct_icon.dart";

/// Calculateur de poutres: a standalone statics tool for one simply
/// supported beam under a uniformly distributed load — reactions, max
/// moment/shear (ELU) and a midspan deflection check (ELS vs span/250).
/// Distinct from the "Poutre" prédimensionnement/dimensionnement entries,
/// which size a section from scratch instead of analysing a given one.
class BeamCalcScreen extends StatefulWidget {
  const BeamCalcScreen({super.key});

  @override
  State<BeamCalcScreen> createState() => _BeamCalcScreenState();
}

class _BeamCalcScreenState extends State<BeamCalcScreen> {
  double _spanM = 5.0;
  double _gKnM = 8.0;
  double _qKnM = 5.0;
  double _sectionBCm = 25;
  double _sectionHCm = 45;
  String _beton = "C25/30";

  SimplySupportedBeamResult get _result => analyzeSimplySupportedBeamUdl(
        spanM: _spanM,
        gKnM: _gKnM,
        qKnM: _qKnM,
        sectionBCm: _sectionBCm,
        sectionHCm: _sectionHCm,
        fckMpa: fckOf(_beton),
      );

  @override
  Widget build(BuildContext context) {
    final result = _result;
    return Scaffold(
      appBar: AppBar(title: const Text("Calculateur de poutres")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          const Center(
            child: StructIcon(kind: StructIconKind.beamUdl, size: 56, annotation: StructIconAnnotation.load),
          ),
          const SizedBox(height: 4),
          Text(
            "Poutre sur 2 appuis, charge uniformément répartie",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          NumberField(label: "Portée L", unit: "m", value: _spanM, min: 0.5, onChanged: (v) => setState(() => _spanM = v)),
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
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: NumberField(
                  label: "Section b",
                  unit: "cm",
                  value: _sectionBCm,
                  min: 10,
                  onChanged: (v) => setState(() => _sectionBCm = v),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: NumberField(
                  label: "Section h",
                  unit: "cm",
                  value: _sectionHCm,
                  min: 10,
                  onChanged: (v) => setState(() => _sectionHCm = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          PickerField(
            label: "Béton",
            value: _beton,
            options: betonClasses.map((b) => b.id).toList(),
            onChanged: (v) => setState(() => _beton = v),
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
                ResultRow(label: "Réaction d'appui", value: "${result.reactionKn.toStringAsFixed(1)} kN"),
                ResultRow(label: "Moment max (M_ELU)", value: "${result.momentMaxKnM.toStringAsFixed(2)} kN·m"),
                ResultRow(label: "Effort tranchant max", value: "${result.shearMaxKn.toStringAsFixed(1)} kN"),
                const Divider(height: 24),
                ResultRow(
                  label: "Flèche estimée",
                  value: "${result.deflectionMm.toStringAsFixed(1)} mm",
                  highlight: result.deflectionOk ? AppColors.success : AppColors.danger,
                ),
                ResultRow(label: "Limite (L/250)", value: "${result.deflectionLimitMm.toStringAsFixed(1)} mm"),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "M_ELU = w_ELU × L² / 8 · flèche = 5wL⁴/384EI (calcul élastique non fissuré, indicatif)",
            style: TextStyle(fontSize: 11, color: AppColors.textTertiary, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }
}
