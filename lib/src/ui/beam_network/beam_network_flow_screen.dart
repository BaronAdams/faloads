import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_theme.dart";
import "../../widgets/coating_row.dart";
import "../../widgets/moment_diagram.dart";
import "../../widgets/number_field.dart";
import "../../widgets/picker_field.dart";
import "../../widgets/segmented_chips.dart";
import "../common/level_form_state.dart";
import "../common/step_footer.dart";
import "../common/stepper_header.dart";
import "beam_grid_state.dart";

const List<String> _stepLabels = ["Grille", "Dalles", "Résultats"];

/// Descente de charges — Réseau de poutres (spec §6): 3 étapes à l'échelle
/// d'un étage. La grille de travées et les sections par tronçon sont
/// gérées via une liste (pas un canevas tactile — ce niveau d'interaction
/// est réservé au bâtiment complet, phase 6) ; l'assignation des panneaux
/// de dalle, elle, utilise une vraie grille tactile puisque chaque case
/// est naturellement cliquable sans hit-testing personnalisé.
class BeamNetworkFlowScreen extends StatefulWidget {
  const BeamNetworkFlowScreen({super.key});

  @override
  State<BeamNetworkFlowScreen> createState() => _BeamNetworkFlowScreenState();
}

class _BeamNetworkFlowScreenState extends State<BeamNetworkFlowScreen> {
  int _step = 0;
  int _maxReached = 0;

  int _nx = 3;
  int _ny = 2;
  List<double> _spanX = [4, 4, 4];
  List<double> _spanY = [5, 5];

  final Map<BeamKey, BeamSlot> _beams = {};
  final Map<(int, int), PanelSlot> _panels = {};

  BeamSlot _beamSlot(BeamKey k) => _beams.putIfAbsent(k, BeamSlot.new);
  PanelSlot _panelSlot(int i, int j) => _panels.putIfAbsent((i, j), PanelSlot.new);

  Map<BeamKey, BeamLoadResult> get _loads => computeBeamGridLoads(
        spanXM: _spanX,
        spanYM: _spanY,
        panels: {
          for (var i = 0; i < _nx; i++)
            for (var j = 0; j < _ny; j++)
              if (_panels[(i, j)] != null && _panels[(i, j)]!.mode != PanelMode.vide) (i, j): _panels[(i, j)]!.toInput(),
        },
      );

  void _setNx(int v) {
    final next = v.clamp(1, 10).toInt();
    setState(() {
      _nx = next;
      if (_spanX.length < next) {
        _spanX = [..._spanX, ...List.filled(next - _spanX.length, 4.0)];
      } else if (_spanX.length > next) {
        _spanX = _spanX.sublist(0, next);
      }
    });
  }

  void _setNy(int v) {
    final next = v.clamp(1, 10).toInt();
    setState(() {
      _ny = next;
      if (_spanY.length < next) {
        _spanY = [..._spanY, ...List.filled(next - _spanY.length, 4.0)];
      } else if (_spanY.length > next) {
        _spanY = _spanY.sublist(0, next);
      }
    });
  }

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Réseau de poutres")),
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
        return _StepGrille(
          nx: _nx,
          ny: _ny,
          spanX: _spanX,
          spanY: _spanY,
          onNx: _setNx,
          onNy: _setNy,
          onSpanX: (i, v) => setState(() => _spanX[i] = v),
          onSpanY: (j, v) => setState(() => _spanY[j] = v),
          beamSlotOf: _beamSlot,
          onChanged: () => setState(() {}),
        );
      case 1:
        return _StepDalles(nx: _nx, ny: _ny, panelSlotOf: _panelSlot, onChanged: () => setState(() {}));
      default:
        return _StepResultats(nx: _nx, ny: _ny, beamSlotOf: _beamSlot, loads: _loads);
    }
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
    );
  }
}

class _StepGrille extends StatelessWidget {
  const _StepGrille({
    required this.nx,
    required this.ny,
    required this.spanX,
    required this.spanY,
    required this.onNx,
    required this.onNy,
    required this.onSpanX,
    required this.onSpanY,
    required this.beamSlotOf,
    required this.onChanged,
  });

  final int nx, ny;
  final List<double> spanX, spanY;
  final ValueChanged<int> onNx, onNy;
  final void Function(int index, double v) onSpanX, onSpanY;
  final BeamSlot Function(BeamKey) beamSlotOf;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: NumberField(label: "Travées X (nx)", value: nx.toDouble(), min: 1, onChanged: (v) => onNx(v.round())),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: NumberField(label: "Travées Y (ny)", value: ny.toDouble(), min: 1, onChanged: (v) => onNy(v.round())),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const _SectionTitle("Portées X"),
        for (var i = 0; i < nx; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: NumberField(
              key: ValueKey("spanX-$i"),
              label: "Travée X${i + 1}",
              unit: "m",
              value: spanX[i],
              min: 0.5,
              onChanged: (v) => onSpanX(i, v),
            ),
          ),
        const SizedBox(height: 12),
        const _SectionTitle("Portées Y"),
        for (var j = 0; j < ny; j++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: NumberField(
              key: ValueKey("spanY-$j"),
              label: "Travée Y${j + 1}",
              unit: "m",
              value: spanY[j],
              min: 0.5,
              onChanged: (v) => onSpanY(j, v),
            ),
          ),
        const SizedBox(height: 20),
        const _SectionTitle("Poutres horizontales"),
        for (var line = 0; line <= ny; line++)
          for (var segment = 0; segment < nx; segment++)
            _BeamRow(
              key: ValueKey("h-$line-$segment"),
              beamKey: (isHorizontal: true, line: line, segment: segment),
              slot: beamSlotOf((isHorizontal: true, line: line, segment: segment)),
              onChanged: onChanged,
            ),
        const SizedBox(height: 12),
        const _SectionTitle("Poutres verticales"),
        for (var line = 0; line <= nx; line++)
          for (var segment = 0; segment < ny; segment++)
            _BeamRow(
              key: ValueKey("v-$line-$segment"),
              beamKey: (isHorizontal: false, line: line, segment: segment),
              slot: beamSlotOf((isHorizontal: false, line: line, segment: segment)),
              onChanged: onChanged,
            ),
      ],
    );
  }
}

class _BeamRow extends StatelessWidget {
  const _BeamRow({super.key, required this.beamKey, required this.slot, required this.onChanged});

  final BeamKey beamKey;
  final BeamSlot slot;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  beamKeyLabel(beamKey),
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: slot.active ? AppColors.textPrimary : AppColors.textTertiary,
                  ),
                ),
                Text(
                  "${slot.sectionBCm.toStringAsFixed(0)} × ${slot.sectionHCm.toStringAsFixed(0)} cm",
                  style: AppTheme.monoTextStyle(fontSize: 11, color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => _editSection(context),
            icon: const Icon(Icons.edit_outlined, size: 17, color: AppColors.textSecondary),
          ),
          Switch(
            value: slot.active,
            onChanged: (v) {
              slot.active = v;
              onChanged();
            },
          ),
        ],
      ),
    );
  }

  void _editSection(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(beamKeyLabel(beamKey), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: NumberField(
                    label: "Section b",
                    unit: "cm",
                    value: slot.sectionBCm,
                    min: 10,
                    onChanged: (v) {
                      slot.sectionBCm = v;
                      onChanged();
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: NumberField(
                    label: "Section h",
                    unit: "cm",
                    value: slot.sectionHCm,
                    min: 10,
                    onChanged: (v) {
                      slot.sectionHCm = v;
                      onChanged();
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StepDalles extends StatelessWidget {
  const _StepDalles({required this.nx, required this.ny, required this.panelSlotOf, required this.onChanged});

  final int nx, ny;
  final PanelSlot Function(int, int) panelSlotOf;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "Touchez une case pour lui assigner un panneau de dalle.",
          style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 14),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: nx * ny,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: nx,
            mainAxisSpacing: 6,
            crossAxisSpacing: 6,
            childAspectRatio: 1,
          ),
          itemBuilder: (context, index) {
            final i = index % nx;
            final j = index ~/ nx;
            final slot = panelSlotOf(i, j);
            return _PanelCell(slot: slot, onTap: () => _openPanelSheet(context, slot, onChanged));
          },
        ),
      ],
    );
  }
}

String _panelModeShortLabel(PanelMode m) => switch (m) {
      PanelMode.vide => "—",
      PanelMode.complet => "✓",
      PanelMode.demiNe => "NE",
      PanelMode.demiSo => "SO",
    };

String _panelModeFullLabel(PanelMode m) => switch (m) {
      PanelMode.vide => "Vide",
      PanelMode.complet => "Contour complet",
      PanelMode.demiNe => "Demi-contour NE",
      PanelMode.demiSo => "Demi-contour SO",
    };

class _PanelCell extends StatelessWidget {
  const _PanelCell({required this.slot, required this.onTap});

  final PanelSlot slot;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final active = slot.mode != PanelMode.vide;
    return Material(
      color: active ? AppColors.accentTeal.withValues(alpha: 0.16) : AppColors.surface,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: active ? AppColors.accentTeal : AppColors.border),
          ),
          alignment: Alignment.center,
          child: Text(
            _panelModeShortLabel(slot.mode),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: active ? AppColors.accentTeal : AppColors.textTertiary,
            ),
          ),
        ),
      ),
    );
  }
}

void _openPanelSheet(BuildContext context, PanelSlot slot, VoidCallback onChanged) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
    builder: (sheetContext) => StatefulBuilder(
      builder: (sheetContext, setSheetState) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("Panneau de dalle", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                SegmentedChips<PanelMode>(
                  label: "Mode",
                  options: PanelMode.values,
                  optionLabel: _panelModeFullLabel,
                  value: slot.mode,
                  onChanged: (v) {
                    setSheetState(() => slot.mode = v);
                    onChanged();
                  },
                ),
                if (slot.mode != PanelMode.vide) ...[
                  const SizedBox(height: 16),
                  PickerField(
                    label: "Type de dalle",
                    value: slot.slabTypeId,
                    options: slabTypes.map((s) => s.id).toList(),
                    optionLabel: (id) => slabTypes.firstWhere((s) => s.id == id).label,
                    onChanged: (v) {
                      setSheetState(() => slot.slabTypeId = v);
                      onChanged();
                    },
                  ),
                  if (slot.slabType.isDallePleine) ...[
                    const SizedBox(height: 14),
                    NumberField(
                      label: "Épaisseur de la dalle",
                      unit: "m",
                      value: slot.slabThicknessM,
                      min: 0.05,
                      onChanged: (v) {
                        setSheetState(() => slot.slabThicknessM = v);
                        onChanged();
                      },
                    ),
                  ],
                  const SizedBox(height: 14),
                  PickerField(
                    label: "Usage (EC1)",
                    value: slot.usageId,
                    options: usageCategories.map((u) => u.id).toList(),
                    optionLabel: (id) {
                      final u = usageCategories.firstWhere((u) => u.id == id);
                      return "${u.id} — ${u.label}";
                    },
                    onChanged: (v) {
                      setSheetState(() => slot.usageId = v);
                      onChanged();
                    },
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    "Revêtements",
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  for (final coatingSlot in slot.coatings)
                    CoatingRow(
                      key: ValueKey(coatingSlot.id),
                      coating: coatingSlot.coating,
                      onChanged: (c) {
                        setSheetState(() => coatingSlot.coating = c);
                        onChanged();
                      },
                      onRemove: () {
                        setSheetState(() => slot.coatings.remove(coatingSlot));
                        onChanged();
                      },
                    ),
                  OutlinedButton.icon(
                    onPressed: () {
                      setSheetState(() => slot.coatings.add(CoatingSlot(const Coating(name: "Revêtement", loadKnM2: 0.2))));
                      onChanged();
                    },
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text("Ajouter un revêtement"),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    ),
  );
}

class _StepResultats extends StatelessWidget {
  const _StepResultats({required this.nx, required this.ny, required this.beamSlotOf, required this.loads});

  final int nx, ny;
  final BeamSlot Function(BeamKey) beamSlotOf;
  final Map<BeamKey, BeamLoadResult> loads;

  @override
  Widget build(BuildContext context) {
    final activeLoadedKeys = loads.keys.where((k) => beamSlotOf(k).active).toList()
      ..sort((a, b) => beamKeyLabel(a).compareTo(beamKeyLabel(b)));

    if (activeLoadedKeys.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text(
            "Aucune poutre active ne porte de charge — assignez des panneaux "
            "de dalle à l'étape précédente.",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.textTertiary),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "Touchez une poutre pour voir ses charges et son diagramme M(x).",
          style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 14),
        for (final key in activeLoadedKeys)
          _ResultRow(beamKey: key, result: loads[key]!),
      ],
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.beamKey, required this.result});

  final BeamKey beamKey;
  final BeamLoadResult result;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _openResultSheet(context),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
          child: Row(
            children: [
              Expanded(
                child: Text(beamKeyLabel(beamKey), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ),
              Text(
                "q_ELU = ${result.qEluKnM.toStringAsFixed(2)} kN/m",
                style: AppTheme.monoTextStyle(fontSize: 12, color: AppColors.accentAmber),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right, size: 18, color: AppColors.textTertiary),
            ],
          ),
        ),
      ),
    );
  }

  void _openResultSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(beamKeyLabel(beamKey), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(
                "Longueur = ${result.lengthM.toStringAsFixed(2)} m",
                style: AppTheme.monoTextStyle(fontSize: 12, color: AppColors.textTertiary),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _StatTile(label: "q_ELU", value: "${result.qEluKnM.toStringAsFixed(2)} kN/m")),
                  const SizedBox(width: 10),
                  Expanded(child: _StatTile(label: "q_ELS", value: "${result.qElsKnM.toStringAsFixed(2)} kN/m")),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _StatTile(label: "M_max", value: "${result.mMaxKnM.toStringAsFixed(2)} kN.m")),
                  const SizedBox(width: 10),
                  Expanded(child: _StatTile(label: "T_max", value: "${result.tMaxKn.toStringAsFixed(2)} kN")),
                ],
              ),
              const SizedBox(height: 18),
              const Text("Diagramme M(x)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              MomentDiagram(lengthM: result.lengthM, momentAt: result.momentAtKnM),
              const SizedBox(height: 18),
              const Text(
                "Panneaux contributeurs",
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              for (final c in result.contributions)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          "Panneau (${c.panelCol + 1}, ${c.panelRow + 1})",
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ),
                      Text(
                        "${c.linearLoadEluKnM.toStringAsFixed(2)} kN/m",
                        style: AppTheme.monoTextStyle(fontSize: 12),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceRaised,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10.5, color: AppColors.textTertiary)),
          const SizedBox(height: 4),
          Text(value, style: AppTheme.monoTextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
