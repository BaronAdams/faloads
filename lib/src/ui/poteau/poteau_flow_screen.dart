import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_theme.dart";
import "../../widgets/building_profile_view.dart";
import "../../widgets/node_tributary_diagram.dart";
import "../../widgets/number_field.dart";
import "../../widgets/picker_field.dart";
import "../../widgets/predim_result_panel.dart";
import "../../widgets/segmented_chips.dart";
import "../../widgets/system_illustration.dart";
import "../common/level_editor_card.dart";
import "../common/level_form_state.dart";
import "../common/step_footer.dart";
import "../common/stepper_header.dart";

enum SystemeType { poutresEtDalles, dallesSeules }

extension SystemeTypeX on SystemeType {
  String get label => switch (this) {
        SystemeType.poutresEtDalles => "Poteaux + Poutres + Dalles",
        SystemeType.dallesSeules => "Poteaux + Dalles",
      };

  String get description => switch (this) {
        SystemeType.poutresEtDalles => "La dalle repose sur les poutres.",
        SystemeType.dallesSeules => "La dalle porte directement sur les poteaux.",
      };

  bool get withBeams => this == SystemeType.poutresEtDalles;
}

const List<String> _betonOptions = ["C20/25", "C25/30", "C30/37", "C35/45"];
const List<String> _stepLabels = ["Système", "Nœud", "Niveaux", "Récap.", "Résultats"];

/// Descente de charges — Poteau isolé (spec §4): 5-step stepper —
/// système porteur, nœud/aires tributaires, niveaux, récapitulatif,
/// résultats avec prédimensionnement automatique.
class PoteauFlowScreen extends StatefulWidget {
  const PoteauFlowScreen({super.key});

  @override
  State<PoteauFlowScreen> createState() => _PoteauFlowScreenState();
}

class _PoteauFlowScreenState extends State<PoteauFlowScreen> {
  int _step = 0;
  int _maxReached = 0;

  // Step 1 — Système
  SystemeType _systeme = SystemeType.poutresEtDalles;
  Reglement _reglement = Reglement.ec2;
  String _beton = "C25/30";

  // Step 2 — Nœud / aires tributaires
  double _l1 = 3.0; // gauche
  double _l2 = 3.0; // droite
  double _l3 = 3.0; // haut
  double _l4 = 3.0; // bas
  double _poutrePrincipaleB = 25, _poutrePrincipaleH = 40;
  double _poutreSecondaireB = 20, _poutreSecondaireH = 35;

  // Step 3 — Niveaux
  final List<LevelFormState> _levels = [
    LevelFormState(label: "R+1"),
    LevelFormState(label: "RDC"),
  ];

  double get _aireTributaire => (_l1 + _l2) * (_l3 + _l4);

  List<LevelCumulativeResult> get _results => cumulateLoadDescent(
        levelsTopToBottom: _levels.map((l) => l.toLevelInput()).toList(),
        tributaryAreaM2: _aireTributaire,
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
      appBar: AppBar(title: const Text("Poteau isolé")),
      body: Column(
        children: [
          StepperHeader(
            labels: _stepLabels,
            currentStep: _step,
            maxReachedStep: _maxReached,
            onStepTapped: _goTo,
          ),
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
        return _StepSysteme(
          systeme: _systeme,
          reglement: _reglement,
          beton: _beton,
          onSystemeChanged: (v) => setState(() => _systeme = v),
          onReglementChanged: (v) => setState(() => _reglement = v),
          onBetonChanged: (v) => setState(() => _beton = v),
        );
      case 1:
        return _StepNoeud(
          l1: _l1,
          l2: _l2,
          l3: _l3,
          l4: _l4,
          onL1: (v) => setState(() => _l1 = v),
          onL2: (v) => setState(() => _l2 = v),
          onL3: (v) => setState(() => _l3 = v),
          onL4: (v) => setState(() => _l4 = v),
          showBeamFields: _systeme == SystemeType.poutresEtDalles,
          poutrePrincipaleB: _poutrePrincipaleB,
          poutrePrincipaleH: _poutrePrincipaleH,
          poutreSecondaireB: _poutreSecondaireB,
          poutreSecondaireH: _poutreSecondaireH,
          onPoutrePrincipaleB: (v) => setState(() => _poutrePrincipaleB = v),
          onPoutrePrincipaleH: (v) => setState(() => _poutrePrincipaleH = v),
          onPoutreSecondaireB: (v) => setState(() => _poutreSecondaireB = v),
          onPoutreSecondaireH: (v) => setState(() => _poutreSecondaireH = v),
        );
      case 2:
        return _StepNiveaux(levels: _levels, onAdd: _addLevel, onRemove: _removeLevel, onChanged: () => setState(() {}));
      case 3:
        return _StepRecap(
          systeme: _systeme,
          reglement: _reglement,
          beton: _beton,
          aireTributaire: _aireTributaire,
          columnPosition: classifyColumnPosition(l1: _l1, l2: _l2, l3: _l3, l4: _l4),
          results: _results,
        );
      default:
        return _StepResultats(results: _results, beton: _beton, reglement: _reglement);
    }
  }
}

class _StepSysteme extends StatelessWidget {
  const _StepSysteme({
    required this.systeme,
    required this.reglement,
    required this.beton,
    required this.onSystemeChanged,
    required this.onReglementChanged,
    required this.onBetonChanged,
  });

  final SystemeType systeme;
  final Reglement reglement;
  final String beton;
  final ValueChanged<SystemeType> onSystemeChanged;
  final ValueChanged<Reglement> onReglementChanged;
  final ValueChanged<String> onBetonChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("Système porteur", style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        const SizedBox(height: 8),
        for (final s in SystemeType.values)
          _SystemOptionCard(type: s, selected: systeme == s, onTap: () => onSystemeChanged(s)),
        const SizedBox(height: 4),
        SegmentedChips<Reglement>(
          label: "Règlement",
          options: Reglement.values,
          optionLabel: (r) => r.label,
          value: reglement,
          onChanged: onReglementChanged,
        ),
        const SizedBox(height: 18),
        PickerField(label: "Béton", value: beton, options: _betonOptions, onChanged: onBetonChanged),
      ],
    );
  }
}

/// One "système porteur" option: a plan-view illustration of its tributary
/// quadrants (with beam bands overlaid when the system routes loads
/// through poutres) above the title/description — spec §4 step 1.
class _SystemOptionCard extends StatelessWidget {
  const _SystemOptionCard({required this.type, required this.selected, required this.onTap});

  final SystemeType type;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: selected ? AppColors.accentBlue.withValues(alpha: 0.06) : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? AppColors.accentBlue : AppColors.border, width: selected ? 2 : 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 132,
                width: double.infinity,
                decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8)),
                clipBehavior: Clip.antiAlias,
                child: SystemIllustration(withBeams: type.withBeams),
              ),
              const SizedBox(height: 12),
              Text(type.label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(type.description, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary, height: 1.45)),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepNoeud extends StatelessWidget {
  const _StepNoeud({
    required this.l1,
    required this.l2,
    required this.l3,
    required this.l4,
    required this.onL1,
    required this.onL2,
    required this.onL3,
    required this.onL4,
    required this.showBeamFields,
    required this.poutrePrincipaleB,
    required this.poutrePrincipaleH,
    required this.poutreSecondaireB,
    required this.poutreSecondaireH,
    required this.onPoutrePrincipaleB,
    required this.onPoutrePrincipaleH,
    required this.onPoutreSecondaireB,
    required this.onPoutreSecondaireH,
  });

  final double l1, l2, l3, l4;
  final ValueChanged<double> onL1, onL2, onL3, onL4;
  final bool showBeamFields;
  final double poutrePrincipaleB, poutrePrincipaleH, poutreSecondaireB, poutreSecondaireH;
  final ValueChanged<double> onPoutrePrincipaleB, onPoutrePrincipaleH, onPoutreSecondaireB, onPoutreSecondaireH;

  @override
  Widget build(BuildContext context) {
    final position = classifyColumnPosition(l1: l1, l2: l2, l3: l3, l4: l4);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        NodeTributaryDiagram(l1: l1, l2: l2, l3: l3, l4: l4, withBeams: showBeamFields),
        const SizedBox(height: 12),
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surfaceRaised,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.accentBlue),
            ),
            child: Text(
              "POTEAU ${position.label}",
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.accentBlue),
            ),
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(child: NumberField(label: "L1 — Gauche", unit: "m", value: l1, onChanged: onL1)),
            const SizedBox(width: 12),
            Expanded(child: NumberField(label: "L2 — Droite", unit: "m", value: l2, onChanged: onL2)),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(child: NumberField(label: "L3 — Haut", unit: "m", value: l3, onChanged: onL3)),
            const SizedBox(width: 12),
            Expanded(child: NumberField(label: "L4 — Bas", unit: "m", value: l4, onChanged: onL4)),
          ],
        ),
        if (showBeamFields) ...[
          const SizedBox(height: 22),
          const Text("Poutre principale", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: NumberField(label: "b", unit: "cm", value: poutrePrincipaleB, onChanged: onPoutrePrincipaleB)),
              const SizedBox(width: 12),
              Expanded(child: NumberField(label: "h", unit: "cm", value: poutrePrincipaleH, onChanged: onPoutrePrincipaleH)),
            ],
          ),
          const SizedBox(height: 18),
          const Text("Poutre secondaire", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: NumberField(label: "b", unit: "cm", value: poutreSecondaireB, onChanged: onPoutreSecondaireB)),
              const SizedBox(width: 12),
              Expanded(child: NumberField(label: "h", unit: "cm", value: poutreSecondaireH, onChanged: onPoutreSecondaireH)),
            ],
          ),
        ],
      ],
    );
  }
}

class _StepNiveaux extends StatelessWidget {
  const _StepNiveaux({
    required this.levels,
    required this.onAdd,
    required this.onRemove,
    required this.onChanged,
  });

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
            sectionEditor: _ColumnSectionEditor(level: level, onChanged: onChanged),
          ),
        const SizedBox(height: 4),
        OutlinedButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add, size: 16),
          label: const Text("Ajouter un niveau"),
        ),
        const SizedBox(height: 20),
        BuildingProfileView(
          shape: ProfileElementShape.column,
          levels: [
            for (final level in levels)
              ProfileLevelDrawing(
                label: level.label,
                heightM: level.heightM,
                sectionLabel: "${level.extraOr("b", 25).toStringAsFixed(0)}×${level.extraOr("h", 25).toStringAsFixed(0)}",
              ),
          ],
        ),
      ],
    );
  }
}

class _ColumnSectionEditor extends StatelessWidget {
  const _ColumnSectionEditor({required this.level, required this.onChanged});

  final LevelFormState level;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: NumberField(
            label: "Section b",
            unit: "cm",
            value: level.extraOr("b", 25),
            onChanged: (v) {
              level.extra["b"] = v;
              onChanged();
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: NumberField(
            label: "Section h",
            unit: "cm",
            value: level.extraOr("h", 25),
            onChanged: (v) {
              level.extra["h"] = v;
              onChanged();
            },
          ),
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
    required this.aireTributaire,
    required this.columnPosition,
    required this.results,
  });

  final SystemeType systeme;
  final Reglement reglement;
  final String beton;
  final double aireTributaire;
  final ColumnPosition columnPosition;
  final List<LevelCumulativeResult> results;

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
              _RecapRow("Aire tributaire totale", "${aireTributaire.toStringAsFixed(2)} m²"),
              _RecapRow("Type de poteau", columnPosition.label),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const Text("Charges par niveau", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        _LevelLoadsTable(results: results),
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

class _LevelLoadsTable extends StatelessWidget {
  const _LevelLoadsTable({required this.results});

  final List<LevelCumulativeResult> results;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
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
              DataCell(Text(r.label, style: const TextStyle(fontSize: 12))),
              DataCell(Text(r.heightM.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
              DataCell(Text(r.gDalleForceKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
              DataCell(Text(r.gRevForceKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
              DataCell(Text(r.qForceKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
              DataCell(Text(r.gTotCumulativeKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
              DataCell(Text(r.qTotCumulativeKn.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 12))),
            ]),
        ],
      ),
    );
  }
}

class _StepResultats extends StatelessWidget {
  const _StepResultats({required this.results, required this.beton, required this.reglement});

  final List<LevelCumulativeResult> results;
  final String beton;
  final Reglement reglement;

  @override
  Widget build(BuildContext context) {
    final baseNelu = results.isEmpty ? 0.0 : results.last.nEluKn;
    final predim = predimPoteau(nEluKn: baseNelu, beton: beton, reglement: reglement);

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
            columnSpacing: 24,
            columns: const [
              DataColumn(label: Text("Niv.")),
              DataColumn(label: Text("N_ELU (kN)")),
              DataColumn(label: Text("N_ELS (kN)")),
            ],
            rows: [
              for (final r in results)
                DataRow(cells: [
                  DataCell(Text(r.label, style: const TextStyle(fontSize: 12))),
                  DataCell(Text(r.nEluKn.toStringAsFixed(1), style: AppTheme.monoTextStyle(fontSize: 12))),
                  DataCell(Text(r.nElsKn.toStringAsFixed(1), style: AppTheme.monoTextStyle(fontSize: 12))),
                ]),
            ],
          ),
        ),
        const SizedBox(height: 20),
        PredimResultPanel(
          result: PredimResultData(
            big: "${predim.sideCm.toStringAsFixed(0)} × ${predim.sideCm.toStringAsFixed(0)} cm",
            sub: "N_ELU = ${baseNelu.toStringAsFixed(1)} kN · A_min = ${predim.aminCm2.toStringAsFixed(0)} cm² · fck = ${predim.fckMpa} MPa",
            formula: "N_ELU ≤ 0.8 × Ac × fcd",
          ),
        ),
      ],
    );
  }
}
