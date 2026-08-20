import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_theme.dart";
import "../../widgets/number_field.dart";
import "../../widgets/picker_field.dart";
import "../../widgets/predim_result_panel.dart";
import "../../widgets/segmented_chips.dart";
import "../common/level_editor_card.dart";
import "../common/level_form_state.dart";
import "../common/step_footer.dart";
import "../common/stepper_header.dart";
import "../poteau/poteau_flow_screen.dart" show SystemeType, SystemeTypeX;

const List<String> _betonOptions = ["C20/25", "C25/30", "C30/37", "C35/45"];
const List<String> _zoneOptions = ["I", "II", "III", "IV"];
const List<String> _terrainOptions = ["0", "II", "IIIa", "IIIb", "IV"];
const List<int> _directionOptions = [0, 90, 180, 270];
const List<String> _stepLabels = ["Système", "Aire tributaire", "Niveaux", "Récap.", "Résultats"];

/// Descente de charges — Voile isolé (spec §5): même structure que le
/// poteau isolé, avec un bloc Vent EC1 en étape 1, une aire tributaire
/// définie par longueur + 2 portées en étape 2, et un cumul de F_vent
/// (avec badge "Vent dominant") en résultats.
class VoileFlowScreen extends StatefulWidget {
  const VoileFlowScreen({super.key});

  @override
  State<VoileFlowScreen> createState() => _VoileFlowScreenState();
}

class _VoileFlowScreenState extends State<VoileFlowScreen> {
  int _step = 0;
  int _maxReached = 0;

  // Step 1 — Système + Vent EC1
  SystemeType _systeme = SystemeType.poutresEtDalles;
  Reglement _reglement = Reglement.ec2;
  String _beton = "C25/30";
  String _ventZone = "II";
  String _ventRegion = "Intérieure";
  String _ventTerrain = "IIIb";
  int _ventDirection = 0;

  // Step 2 — Aire tributaire
  double _longueur = 4.0; // wall's own length
  double _porteeAvant = 3.0;
  double _porteeArriere = 3.0;

  // Step 3 — Niveaux
  final List<LevelFormState> _levels = [
    LevelFormState(label: "R+1"),
    LevelFormState(label: "RDC"),
  ];

  double get _aireTributaire => _longueur * (_porteeAvant + _porteeArriere);

  List<WindLevelCumulativeResult> get _results => cumulateWallLoadDescent(
        levelsTopToBottom: _levels.map((l) => l.toLevelInput()).toList(),
        tributaryAreaM2: _aireTributaire,
        wallLengthM: _longueur,
      );

  void _goTo(int step) {
    if (step <= _maxReached) setState(() => _step = step);
  }

  void _next() {
    if (_step < _stepLabels.length - 1) {
      setState(() {
        _step++;
        if (_step > _maxReached) _maxReached = _step;
      });
    } else {
      Navigator.of(context).pop();
    }
  }

  void _previous() => setState(() => _step = (_step - 1).clamp(0, _stepLabels.length - 1).toInt());

  void _addLevel() {
    setState(() => _levels.insert(_levels.length - 1, LevelFormState(label: "Niveau ${_levels.length}")));
  }

  void _removeLevel(LevelFormState level) {
    if (_levels.length <= 1) return;
    setState(() => _levels.remove(level));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Voile isolé")),
      body: Column(
        children: [
          StepperHeader(labels: _stepLabels, currentStep: _step, maxReachedStep: _maxReached, onStepTapped: _goTo),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [_buildStep()],
            ),
          ),
          StepFooter(
            showPrevious: _step > 0,
            onPrevious: _previous,
            nextLabel: _step < _stepLabels.length - 1 ? "Suivant →" : "Terminer ✓",
            onNext: _next,
          ),
        ],
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 0:
        return _StepSystemeVent(
          systeme: _systeme,
          reglement: _reglement,
          beton: _beton,
          zone: _ventZone,
          region: _ventRegion,
          terrain: _ventTerrain,
          direction: _ventDirection,
          onSystemeChanged: (v) => setState(() => _systeme = v),
          onReglementChanged: (v) => setState(() => _reglement = v),
          onBetonChanged: (v) => setState(() => _beton = v),
          onZoneChanged: (v) => setState(() => _ventZone = v),
          onRegionChanged: (v) => setState(() => _ventRegion = v),
          onTerrainChanged: (v) => setState(() => _ventTerrain = v),
          onDirectionChanged: (v) => setState(() => _ventDirection = v),
        );
      case 1:
        return _StepAireTributaire(
          longueur: _longueur,
          porteeAvant: _porteeAvant,
          porteeArriere: _porteeArriere,
          onLongueur: (v) => setState(() => _longueur = v),
          onAvant: (v) => setState(() => _porteeAvant = v),
          onArriere: (v) => setState(() => _porteeArriere = v),
        );
      case 2:
        return _StepNiveaux(levels: _levels, onAdd: _addLevel, onRemove: _removeLevel, onChanged: () => setState(() {}));
      case 3:
        return _StepRecap(
          systeme: _systeme,
          reglement: _reglement,
          beton: _beton,
          longueur: _longueur,
          aireTributaire: _aireTributaire,
          results: _results,
        );
      default:
        return _StepResultats(results: _results, longueur: _longueur, beton: _beton, reglement: _reglement);
    }
  }
}

class _StepSystemeVent extends StatelessWidget {
  const _StepSystemeVent({
    required this.systeme,
    required this.reglement,
    required this.beton,
    required this.zone,
    required this.region,
    required this.terrain,
    required this.direction,
    required this.onSystemeChanged,
    required this.onReglementChanged,
    required this.onBetonChanged,
    required this.onZoneChanged,
    required this.onRegionChanged,
    required this.onTerrainChanged,
    required this.onDirectionChanged,
  });

  final SystemeType systeme;
  final Reglement reglement;
  final String beton;
  final String zone;
  final String region;
  final String terrain;
  final int direction;
  final ValueChanged<SystemeType> onSystemeChanged;
  final ValueChanged<Reglement> onReglementChanged;
  final ValueChanged<String> onBetonChanged;
  final ValueChanged<String> onZoneChanged;
  final ValueChanged<String> onRegionChanged;
  final ValueChanged<String> onTerrainChanged;
  final ValueChanged<int> onDirectionChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SegmentedChips<SystemeType>(
          label: "Système porteur",
          options: SystemeType.values,
          optionLabel: (s) => s.label,
          value: systeme,
          onChanged: onSystemeChanged,
        ),
        const SizedBox(height: 18),
        SegmentedChips<Reglement>(
          label: "Règlement",
          options: Reglement.values,
          optionLabel: (r) => r.label,
          value: reglement,
          onChanged: onReglementChanged,
        ),
        const SizedBox(height: 18),
        PickerField(label: "Béton", value: beton, options: _betonOptions, onChanged: onBetonChanged),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("Vent EC1", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              const Text(
                "Zone / région / terrain sont indicatifs pour le rapport ; le calcul "
                "utilise un modèle simplifié de pression selon l'altitude uniquement.",
                style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
              ),
              const SizedBox(height: 14),
              PickerField(label: "Zone de vent", value: zone, options: _zoneOptions, onChanged: onZoneChanged),
              const SizedBox(height: 14),
              TextFormField(
                initialValue: region,
                decoration: const InputDecoration(isDense: true, labelText: "Région"),
                onChanged: onRegionChanged,
              ),
              const SizedBox(height: 14),
              PickerField(
                label: "Catégorie de terrain",
                value: terrain,
                options: _terrainOptions,
                onChanged: onTerrainChanged,
              ),
              const SizedBox(height: 14),
              SegmentedChips<int>(
                label: "Direction du vent",
                options: _directionOptions,
                optionLabel: (d) => "$d°",
                value: direction,
                onChanged: onDirectionChanged,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StepAireTributaire extends StatelessWidget {
  const _StepAireTributaire({
    required this.longueur,
    required this.porteeAvant,
    required this.porteeArriere,
    required this.onLongueur,
    required this.onAvant,
    required this.onArriere,
  });

  final double longueur, porteeAvant, porteeArriere;
  final ValueChanged<double> onLongueur, onAvant, onArriere;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        NumberField(label: "Longueur du voile", unit: "m", value: longueur, min: 0.1, onChanged: onLongueur),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: NumberField(label: "Portée avant", unit: "m", value: porteeAvant, onChanged: onAvant),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: NumberField(label: "Portée arrière", unit: "m", value: porteeArriere, onChanged: onArriere),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          "Aire tributaire = ${(longueur * (porteeAvant + porteeArriere)).toStringAsFixed(2)} m²",
          style: AppTheme.monoTextStyle(fontSize: 13, color: AppColors.accentBlue),
        ),
      ],
    );
  }
}

class _StepNiveaux extends StatelessWidget {
  const _StepNiveaux({required this.levels, required this.onAdd, required this.onRemove, required this.onChanged});

  final List<LevelFormState> levels;
  final VoidCallback onAdd;
  final ValueChanged<LevelFormState> onRemove;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final level in levels)
          LevelEditorCard(
            key: ValueKey(level.id),
            level: level,
            initiallyExpanded: levels.length <= 2,
            onChanged: onChanged,
            onRemove: () => onRemove(level),
            sectionEditor: NumberField(
              label: "Épaisseur du voile",
              unit: "cm",
              value: level.extraOr("epaisseur", 20),
              min: 5,
              onChanged: (v) {
                level.extra["epaisseur"] = v;
                onChanged();
              },
            ),
          ),
        const SizedBox(height: 4),
        OutlinedButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add, size: 16),
          label: const Text("Ajouter un niveau"),
        ),
      ],
    );
  }
}

class _StepRecap extends StatelessWidget {
  const _StepRecap({
    required this.systeme,
    required this.reglement,
    required this.beton,
    required this.longueur,
    required this.aireTributaire,
    required this.results,
  });

  final SystemeType systeme;
  final Reglement reglement;
  final String beton;
  final double longueur;
  final double aireTributaire;
  final List<WindLevelCumulativeResult> results;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _RecapRow("Système porteur", systeme.label),
              _RecapRow("Règlement", reglement.label),
              _RecapRow("Classe de béton", beton),
              _RecapRow("Longueur du voile", "${longueur.toStringAsFixed(2)} m"),
              _RecapRow("Aire tributaire totale", "${aireTributaire.toStringAsFixed(2)} m²"),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const Text("Charges par niveau", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowHeight: 34,
            dataRowMinHeight: 32,
            dataRowMaxHeight: 36,
            columnSpacing: 18,
            columns: const [
              DataColumn(label: Text("Niv.")),
              DataColumn(label: Text("h (m)")),
              DataColumn(label: Text("G_dalle")),
              DataColumn(label: Text("G_rev")),
              DataColumn(label: Text("Q")),
              DataColumn(label: Text("G_tot")),
              DataColumn(label: Text("Q_tot")),
            ],
            rows: [
              for (final r in results)
                DataRow(cells: [
                  DataCell(Text(r.base.label, style: const TextStyle(fontSize: 12))),
                  DataCell(Text(r.base.heightM.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
                  DataCell(Text(r.base.gDalleForceKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
                  DataCell(Text(r.base.gRevForceKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
                  DataCell(Text(r.base.qForceKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
                  DataCell(Text(r.base.gTotCumulativeKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
                  DataCell(Text(r.base.qTotCumulativeKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
                ]),
            ],
          ),
        ),
      ],
    );
  }
}

class _RecapRow extends StatelessWidget {
  const _RecapRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary))),
          Text(value, style: AppTheme.monoTextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _StepResultats extends StatelessWidget {
  const _StepResultats({
    required this.results,
    required this.longueur,
    required this.beton,
    required this.reglement,
  });

  final List<WindLevelCumulativeResult> results;
  final double longueur;
  final String beton;
  final Reglement reglement;

  @override
  Widget build(BuildContext context) {
    final baseNelu = results.isEmpty ? 0.0 : results.last.base.nEluKn;
    final predim = predimVoile(nEluKn: baseNelu, beton: beton, reglement: reglement, longueurM: longueur);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("Descente de charges cumulée", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowHeight: 34,
            dataRowMinHeight: 32,
            dataRowMaxHeight: 36,
            columnSpacing: 20,
            columns: const [
              DataColumn(label: Text("Niv.")),
              DataColumn(label: Text("N_ELU (kN)")),
              DataColumn(label: Text("N_ELS (kN)")),
              DataColumn(label: Text("F_vent ELU (kN)")),
              DataColumn(label: Text("")),
            ],
            rows: [
              for (final r in results)
                DataRow(cells: [
                  DataCell(Text(r.base.label, style: const TextStyle(fontSize: 12))),
                  DataCell(Text(r.base.nEluKn.toStringAsFixed(1), style: AppTheme.monoTextStyle(fontSize: 12))),
                  DataCell(Text(r.base.nElsKn.toStringAsFixed(1), style: AppTheme.monoTextStyle(fontSize: 12))),
                  DataCell(Text(r.fVentEluKn.toStringAsFixed(1), style: AppTheme.monoTextStyle(fontSize: 12))),
                  DataCell(
                    r.windDominant
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.danger.withValues(alpha: 0.16),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              "Vent dominant",
                              style: TextStyle(fontSize: 10, color: AppColors.danger, fontWeight: FontWeight.w700),
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),
                ]),
            ],
          ),
        ),
        const SizedBox(height: 20),
        PredimResultPanel(
          result: PredimResultData(
            big: "${predim.eMinCm.toStringAsFixed(0)} cm",
            sub: "N_ELU = ${baseNelu.toStringAsFixed(1)} kN · A_min = ${predim.aminCm2.toStringAsFixed(0)} cm² · fck = ${predim.fckMpa} MPa",
            formula: "N_ELU ≤ 0.8 × (L × e) × fcd",
          ),
        ),
      ],
    );
  }
}
