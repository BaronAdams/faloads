import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../theme/app_colors.dart";
import "../../widgets/number_field.dart";
import "../../widgets/picker_field.dart";
import "../../widgets/predim_result_panel.dart";
import "../../widgets/segmented_chips.dart";

enum PredimElementType { poteau, poutre, voile, plancher, balcon, escalier, murSoutenement, semelle }

extension PredimElementTypeX on PredimElementType {
  String get label => switch (this) {
        PredimElementType.poteau => "Poteau",
        PredimElementType.poutre => "Poutre",
        PredimElementType.voile => "Voile",
        PredimElementType.plancher => "Plancher",
        PredimElementType.balcon => "Balcon",
        PredimElementType.escalier => "Escalier",
        PredimElementType.murSoutenement => "Mur de soutènement",
        PredimElementType.semelle => "Semelle de fondation",
      };

  IconData get icon => switch (this) {
        PredimElementType.poteau => Icons.view_column_outlined,
        PredimElementType.poutre => Icons.horizontal_rule,
        PredimElementType.voile => Icons.view_agenda_outlined,
        PredimElementType.plancher => Icons.grid_on_outlined,
        PredimElementType.balcon => Icons.exit_to_app_outlined,
        PredimElementType.escalier => Icons.stairs_outlined,
        PredimElementType.murSoutenement => Icons.terrain_outlined,
        PredimElementType.semelle => Icons.layers_outlined,
      };
}

const List<String> _betonOptions = ["C20/25", "C25/30", "C30/37", "C35/45"];
const List<String> _plancherTypeOptions = ["plein", "cc16", "cc20", "cc25"];

String _plancherTypeLabel(String id) => switch (id) {
      "plein" => "Dalle pleine",
      "cc16" => "Corps creux 16+4",
      "cc20" => "Corps creux 20+4",
      "cc25" => "Corps creux 25+4",
      _ => id,
    };

/// Mono-écran prédimensionnement (spec §3): a type selector, a contextual
/// parameter panel, and a "section recommandée" result panel with the
/// formula used — the fast, one-screen counterpart to the multi-step
/// descente de charges flows (phases 4-6).
class PredimScreen extends StatefulWidget {
  const PredimScreen({super.key, this.initialType = PredimElementType.poteau});

  final PredimElementType initialType;

  @override
  State<PredimScreen> createState() => _PredimScreenState();
}

class _PredimScreenState extends State<PredimScreen> {
  late PredimElementType _type = widget.initialType;

  // Poteau
  double _poteauNelu = 800;
  String _poteauBeton = "C25/30";
  Reglement _poteauReglement = Reglement.ec2;

  // Poutre
  double _poutreL = 4.0;
  double _poutreQ = 15.0;
  AppuiType _poutreAppui = AppuiType.isostatique;

  // Voile
  double _voileNelu = 600;
  double _voileLongueur = 3.0;
  String _voileBeton = "C25/30";
  Reglement _voileReglement = Reglement.ec2;

  // Plancher
  double _plancherPortee = 4.5;
  String _plancherType = "cc16";

  // Balcon
  double _balconPortee = 1.2;
  double _balconG = 3.0;
  double _balconQ = 1.5;

  // Escalier
  double _escalierHauteur = 2.7;
  double _escalierLongueurProjetee = 4.2;
  double _escalierLargeur = 1.0;

  // Mur de soutènement
  double _murHauteur = 2.5;
  double _murGammaSol = 18.0;
  double _murPhi = 30.0;

  // Semelle de fondation
  SemelleType _semelleType = SemelleType.isolee;
  double _semelleNels = 500;
  double _semelleSolBearing = 200;
  double _semelleSupport = 30;

  @override
  Widget build(BuildContext context) {
    final (fields, result) = _buildTypeContent();

    return Scaffold(
      appBar: AppBar(title: const Text("Prédimensionnement")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          SizedBox(
            height: 96,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: PredimElementType.values.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final t = PredimElementType.values[i];
                return _TypeChip(type: t, selected: t == _type, onTap: () => setState(() => _type = t));
              },
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: fields),
          ),
          const SizedBox(height: 16),
          PredimResultPanel(result: result),
        ],
      ),
    );
  }

  (List<Widget>, PredimResultData) _buildTypeContent() {
    switch (_type) {
      case PredimElementType.poteau:
        final r = predimPoteau(nEluKn: _poteauNelu, beton: _poteauBeton, reglement: _poteauReglement);
        return (
          [
            NumberField(
              key: const ValueKey("poteau-nelu"),
              label: "N_ELU",
              unit: "kN",
              value: _poteauNelu,
              onChanged: (v) => setState(() => _poteauNelu = v),
            ),
            const SizedBox(height: 14),
            PickerField(
              label: "Béton",
              value: _poteauBeton,
              options: _betonOptions,
              onChanged: (v) => setState(() => _poteauBeton = v),
            ),
            const SizedBox(height: 14),
            SegmentedChips<Reglement>(
              label: "Règlement",
              options: Reglement.values,
              optionLabel: (r) => r.label,
              value: _poteauReglement,
              onChanged: (v) => setState(() => _poteauReglement = v),
            ),
          ],
          PredimResultData(
            big: "${r.sideCm.toStringAsFixed(0)} × ${r.sideCm.toStringAsFixed(0)} cm",
            sub: "A_min = ${r.aminCm2.toStringAsFixed(0)} cm² · fck = ${r.fckMpa} MPa",
            formula: "N_ELU ≤ 0.8 × Ac × fcd",
          ),
        );

      case PredimElementType.poutre:
        final r = predimPoutre(lM: _poutreL, qEluKnM: _poutreQ, appui: _poutreAppui);
        return (
          [
            NumberField(
              key: const ValueKey("poutre-l"),
              label: "Portée L",
              unit: "m",
              value: _poutreL,
              min: 0.1,
              onChanged: (v) => setState(() => _poutreL = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("poutre-q"),
              label: "Charge q_ELU",
              unit: "kN/m",
              value: _poutreQ,
              onChanged: (v) => setState(() => _poutreQ = v),
            ),
            const SizedBox(height: 14),
            SegmentedChips<AppuiType>(
              label: "Type d'appui",
              options: AppuiType.values,
              optionLabel: (a) => a.label,
              value: _poutreAppui,
              onChanged: (v) => setState(() => _poutreAppui = v),
            ),
          ],
          PredimResultData(
            big: "${r.bCm.toStringAsFixed(0)} × ${r.hCm.toStringAsFixed(0)} cm",
            sub: "M_max = ${r.mMaxKnM.toStringAsFixed(1)} kN.m",
            formula: "h ≈ L / ${_poutreAppui.coeffH.toStringAsFixed(0)},  b ≈ h / 2",
          ),
        );

      case PredimElementType.voile:
        final r = predimVoile(
          nEluKn: _voileNelu,
          beton: _voileBeton,
          reglement: _voileReglement,
          longueurM: _voileLongueur,
        );
        return (
          [
            NumberField(
              key: const ValueKey("voile-nelu"),
              label: "N_ELU",
              unit: "kN",
              value: _voileNelu,
              onChanged: (v) => setState(() => _voileNelu = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("voile-longueur"),
              label: "Longueur",
              unit: "m",
              value: _voileLongueur,
              min: 0.1,
              onChanged: (v) => setState(() => _voileLongueur = v),
            ),
            const SizedBox(height: 14),
            PickerField(
              label: "Béton",
              value: _voileBeton,
              options: _betonOptions,
              onChanged: (v) => setState(() => _voileBeton = v),
            ),
            const SizedBox(height: 14),
            SegmentedChips<Reglement>(
              label: "Règlement",
              options: Reglement.values,
              optionLabel: (r) => r.label,
              value: _voileReglement,
              onChanged: (v) => setState(() => _voileReglement = v),
            ),
          ],
          PredimResultData(
            big: "${r.eMinCm.toStringAsFixed(0)} cm",
            sub: "A_min = ${r.aminCm2.toStringAsFixed(0)} cm² · fck = ${r.fckMpa} MPa",
            formula: "N_ELU ≤ 0.8 × (L × e) × fcd",
          ),
        );

      case PredimElementType.plancher:
        final pleine = _plancherType == "plein";
        final r = predimPlancher(porteeM: _plancherPortee, pleine: pleine);
        return (
          [
            NumberField(
              key: const ValueKey("plancher-portee"),
              label: "Portée",
              unit: "m",
              value: _plancherPortee,
              min: 0.1,
              onChanged: (v) => setState(() => _plancherPortee = v),
            ),
            const SizedBox(height: 14),
            PickerField(
              label: "Type",
              value: _plancherType,
              options: _plancherTypeOptions,
              optionLabel: _plancherTypeLabel,
              onChanged: (v) => setState(() => _plancherType = v),
            ),
          ],
          PredimResultData(
            big: r.label,
            sub: "Portée = ${_plancherPortee.toStringAsFixed(2)} m",
            formula: pleine
                ? "e ≈ L / 25 (dalle pleine, appuis simples)"
                : "Épaisseur normalisée selon portée (abaque corps creux)",
          ),
        );

      case PredimElementType.balcon:
        final r = predimBalcon(porteeM: _balconPortee, gKnM2: _balconG, qKnM2: _balconQ);
        return (
          [
            NumberField(
              key: const ValueKey("balcon-portee"),
              label: "Portée en console",
              unit: "m",
              value: _balconPortee,
              min: 0.1,
              onChanged: (v) => setState(() => _balconPortee = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("balcon-g"),
              label: "G",
              unit: "kN/m²",
              value: _balconG,
              onChanged: (v) => setState(() => _balconG = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("balcon-q"),
              label: "Q",
              unit: "kN/m²",
              value: _balconQ,
              onChanged: (v) => setState(() => _balconQ = v),
            ),
          ],
          PredimResultData(
            big: "${r.epaisseurCm.toStringAsFixed(0)} cm",
            sub: "M_ELU = ${r.muKnM.toStringAsFixed(2)} kN.m/ml",
            formula: "e ≈ L_console / 10 — armature filante en fibre supérieure",
          ),
        );

      case PredimElementType.escalier:
        final r = predimEscalier(
          hauteurM: _escalierHauteur,
          longueurProjeteeM: _escalierLongueurProjetee,
        );
        return (
          [
            NumberField(
              key: const ValueKey("escalier-hauteur"),
              label: "Hauteur à franchir",
              unit: "m",
              value: _escalierHauteur,
              min: 0.1,
              onChanged: (v) => setState(() => _escalierHauteur = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("escalier-longueur"),
              label: "Longueur projetée",
              unit: "m",
              value: _escalierLongueurProjetee,
              min: 0.1,
              onChanged: (v) => setState(() => _escalierLongueurProjetee = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("escalier-largeur"),
              label: "Largeur",
              unit: "m",
              value: _escalierLargeur,
              min: 0.1,
              onChanged: (v) => setState(() => _escalierLargeur = v),
            ),
          ],
          PredimResultData(
            big: "${r.nMarches} marches · ${r.epaisseurCm.toStringAsFixed(0)} cm",
            sub: "g = ${r.gironCm.toStringAsFixed(1)} cm · h = ${r.hMarcheCm.toStringAsFixed(1)} cm · "
                "Blondel = ${r.blondelCm.toStringAsFixed(1)} cm ${r.blondelOk ? '✓' : '⚠'}",
            formula: "Loi de Blondel : 2h + g ∈ [58, 64] cm",
          ),
        );

      case PredimElementType.murSoutenement:
        final r = predimMurSoutenement(hauteurM: _murHauteur, gammaSolKnM3: _murGammaSol, phiDeg: _murPhi);
        return (
          [
            NumberField(
              key: const ValueKey("mur-hauteur"),
              label: "Hauteur du mur",
              unit: "m",
              value: _murHauteur,
              min: 0.3,
              onChanged: (v) => setState(() => _murHauteur = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("mur-gamma"),
              label: "Poids volumique du sol",
              unit: "kN/m³",
              value: _murGammaSol,
              min: 12,
              onChanged: (v) => setState(() => _murGammaSol = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("mur-phi"),
              label: "Angle de frottement φ",
              unit: "°",
              value: _murPhi,
              min: 5,
              onChanged: (v) => setState(() => _murPhi = v),
            ),
          ],
          PredimResultData(
            big: "Semelle ${r.baseWidthCm.toStringAsFixed(0)} cm · voile ${r.stemThicknessCm.toStringAsFixed(0)} cm",
            sub: "Poussée active Pa = ${r.activeThrustKnM.toStringAsFixed(1)} kN/ml · Ka = ${r.kaCoeff.toStringAsFixed(3)}",
            formula: "Pa = 0.5 × Ka × γ_sol × H² · B ≈ 0.6 × H",
          ),
        );

      case PredimElementType.semelle:
        final r = predimSemelle(
          type: _semelleType,
          nElsKn: _semelleNels,
          solBearingKnM2: _semelleSolBearing,
          supportCm: _semelleSupport,
        );
        return (
          [
            SegmentedChips<SemelleType>(
              label: "Type",
              options: SemelleType.values,
              optionLabel: (t) => t.label,
              value: _semelleType,
              onChanged: (v) => setState(() => _semelleType = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("semelle-nels"),
              label: _semelleType == SemelleType.isolee ? "N_ELS" : "N_ELS (par ml)",
              unit: "kN",
              value: _semelleNels,
              onChanged: (v) => setState(() => _semelleNels = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("semelle-sol"),
              label: "Contrainte admissible du sol",
              unit: "kN/m²",
              value: _semelleSolBearing,
              min: 50,
              onChanged: (v) => setState(() => _semelleSolBearing = v),
            ),
            const SizedBox(height: 14),
            NumberField(
              key: const ValueKey("semelle-support"),
              label: _semelleType == SemelleType.isolee ? "Section poteau" : "Épaisseur voile",
              unit: "cm",
              value: _semelleSupport,
              min: 10,
              onChanged: (v) => setState(() => _semelleSupport = v),
            ),
          ],
          PredimResultData(
            big: _semelleType == SemelleType.isolee
                ? "${r.widthCm.toStringAsFixed(0)} × ${r.widthCm.toStringAsFixed(0)} × ${r.heightCm.toStringAsFixed(0)} cm"
                : "B = ${r.widthCm.toStringAsFixed(0)} cm · d = ${r.heightCm.toStringAsFixed(0)} cm",
            sub: _semelleType == SemelleType.isolee
                ? "Aire = ${r.areaM2.toStringAsFixed(2)} m²"
                : "Largeur = ${r.areaM2.toStringAsFixed(2)} m/ml",
            formula: "A = N_ELS / σ_sol · d ≥ (B − support) / 4",
          ),
        );
    }
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({required this.type, required this.selected, required this.onTap});

  final PredimElementType type;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.surfaceRaised : AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          width: 88,
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? AppColors.accentBlue : AppColors.border),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(type.icon, size: 18, color: selected ? AppColors.accentBlue : AppColors.textSecondary),
              const SizedBox(height: 6),
              // Longer labels ("Mur de soutènement", "Semelle de fondation")
              // must not be able to overflow this fixed-height chip —
              // capped to 2 lines with an ellipsis rather than sized to fit.
              Text(
                type.label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  height: 1.15,
                  color: selected ? AppColors.textPrimary : AppColors.textTertiary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

