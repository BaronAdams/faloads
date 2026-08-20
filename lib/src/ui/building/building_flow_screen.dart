import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_theme.dart";
import "../../widgets/coating_row.dart";
import "../../widgets/number_field.dart";
import "../../widgets/picker_field.dart";
import "../../widgets/segmented_chips.dart";
import "../common/level_form_state.dart";
import "../common/step_footer.dart";
import "../common/stepper_header.dart";
import "building_plan_canvas.dart";
import "building_state.dart";

const List<String> _stepLabels = ["Modélisation", "Vent", "Résultats"];
const List<String> _zoneOptions = ["I", "II", "III", "IV"];
const List<String> _terrainOptions = ["0", "II", "IIIa", "IIIb", "IV"];
const List<int> _directionOptions = [0, 90, 180, 270];

/// Descente de charges — Bâtiment complet (spec §7), the richest flow: a
/// pan/zoom plan per floor with poteaux/poutres-voiles/panneaux de dalle
/// all individually selectable and editable, reusable dimension presets,
/// duplicable floors, a Vent EC1 step, and per-floor results.
///
/// Scope note: results are computed per floor rather than cumulated top-
/// to-bottom across floors the way the poteau/voile isolé flows do — doing
/// that faithfully requires floors to stay grid-aligned across the whole
/// building, which duplication encourages but doesn't guarantee. Per-floor
/// results are still real, computed numbers; cross-floor accumulation is a
/// natural fast-follow once that alignment invariant is decided on.
class BuildingFlowScreen extends StatefulWidget {
  const BuildingFlowScreen({super.key});

  @override
  State<BuildingFlowScreen> createState() => _BuildingFlowScreenState();
}

class _BuildingFlowScreenState extends State<BuildingFlowScreen> {
  final _building = BuildingState();
  int _step = 0;
  int _maxReached = 0;

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

  void _onChanged() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Bâtiment complet"),
        actions: [
          IconButton(
            tooltip: "Dimensions types",
            icon: const Icon(Icons.straighten),
            onPressed: () => _openPresetManager(context),
          ),
        ],
      ),
      body: Column(
        children: [
          StepperHeader(labels: _stepLabels, currentStep: _step, maxReachedStep: _maxReached, onStepTapped: _goTo),
          Expanded(child: _buildStep()),
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
        return _StepModelisation(building: _building, onChanged: _onChanged);
      case 1:
        return _StepVent(building: _building, onChanged: _onChanged);
      default:
        return _StepResultats(building: _building, onChanged: _onChanged);
    }
  }

  void _openPresetManager(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => _PresetManagerDialog(building: _building, onChanged: _onChanged),
    );
  }
}

// --- Step 1: Modélisation ------------------------------------------------

class _StepModelisation extends StatelessWidget {
  const _StepModelisation({required this.building, required this.onChanged});

  final BuildingState building;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final floor = building.currentFloor;
    return Column(
      children: [
        _FloorBar(building: building, onChanged: onChanged),
        _GridSummaryBar(floor: floor, onEdit: () => _openGridSheet(context)),
        Expanded(
          child: BuildingPlanCanvas(
            floor: floor,
            selection: building.selection,
            onSelect: (s) {
              building.selection = s;
              onChanged();
            },
          ),
        ),
        if (building.selection != null)
          _SelectedElementBar(
            building: building,
            onChanged: onChanged,
            onModify: () => _openSelectionSheet(context),
          ),
      ],
    );
  }

  void _openGridSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          final floor = building.currentFloor;
          void applyResize() {
            setSheetState(() {});
            onChanged();
          }

          return Padding(
            padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Grille de l'étage", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: NumberField(
                          label: "Travées X (nx)",
                          value: floor.nx.toDouble(),
                          min: 1,
                          onChanged: (v) {
                            final next = v.round().clamp(1, 10).toInt();
                            floor.nx = next;
                            if (floor.spanXM.length < next) {
                              floor.spanXM = [...floor.spanXM, ...List.filled(next - floor.spanXM.length, 4.0)];
                            } else if (floor.spanXM.length > next) {
                              floor.spanXM = floor.spanXM.sublist(0, next);
                            }
                            applyResize();
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: NumberField(
                          label: "Travées Y (ny)",
                          value: floor.ny.toDouble(),
                          min: 1,
                          onChanged: (v) {
                            final next = v.round().clamp(1, 10).toInt();
                            floor.ny = next;
                            if (floor.spanYM.length < next) {
                              floor.spanYM = [...floor.spanYM, ...List.filled(next - floor.spanYM.length, 4.0)];
                            } else if (floor.spanYM.length > next) {
                              floor.spanYM = floor.spanYM.sublist(0, next);
                            }
                            applyResize();
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  NumberField(
                    label: "Hauteur d'étage",
                    unit: "m",
                    value: floor.heightM,
                    min: 0.1,
                    onChanged: (v) {
                      floor.heightM = v;
                      onChanged();
                    },
                  ),
                  const SizedBox(height: 16),
                  const Text("Portées X", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                  const SizedBox(height: 8),
                  for (var i = 0; i < floor.nx; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: NumberField(
                        key: ValueKey("bx-$i"),
                        label: "X${i + 1}",
                        unit: "m",
                        value: floor.spanXM[i],
                        min: 0.5,
                        onChanged: (v) {
                          floor.spanXM[i] = v;
                          onChanged();
                        },
                      ),
                    ),
                  const SizedBox(height: 8),
                  const Text("Portées Y", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                  const SizedBox(height: 8),
                  for (var j = 0; j < floor.ny; j++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: NumberField(
                        key: ValueKey("by-$j"),
                        label: "Y${j + 1}",
                        unit: "m",
                        value: floor.spanYM[j],
                        min: 0.5,
                        onChanged: (v) {
                          floor.spanYM[j] = v;
                          onChanged();
                        },
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _openSelectionSheet(BuildContext context) {
    final selection = building.selection;
    if (selection == null) return;
    switch (selection) {
      case NodeSelection():
        _openNodeSheet(context, selection);
        break;
      case EdgeSelection():
        _openEdgeSheet(context, selection);
        break;
      case PanelSelection():
        _openPanelSheet(context, selection);
        break;
    }
  }

  void _openNodeSheet(BuildContext context, NodeSelection selection) {
    final floor = building.currentFloor;
    final node = floor.nodeAt(selection.col, selection.row);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          final presets = building.presets[PresetCategory.poteau]!;
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Poteau ${nodeLabel(selection.col, selection.row)}", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                if (node.exists) ...[
                  if (presets.isNotEmpty)
                    PickerField(
                      label: "Dimension type",
                      value: node.presetName ?? "Personnalisé",
                      options: [...presets.map((p) => p.name), "Personnalisé"],
                      onChanged: (v) {
                        setSheetState(() {
                          if (v == "Personnalisé") {
                            node.presetName = null;
                          } else {
                            final preset = presets.firstWhere((p) => p.name == v);
                            node.presetName = v;
                            node.sectionBCm = preset.aCm;
                            node.sectionHCm = preset.bCm ?? preset.aCm;
                          }
                        });
                        onChanged();
                      },
                    ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: NumberField(
                          label: "Section b",
                          unit: "cm",
                          value: node.sectionBCm,
                          min: 10,
                          onChanged: (v) {
                            setSheetState(() {
                              node.sectionBCm = v;
                              node.presetName = null;
                            });
                            onChanged();
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: NumberField(
                          label: "Section h",
                          unit: "cm",
                          value: node.sectionHCm,
                          min: 10,
                          onChanged: (v) {
                            setSheetState(() {
                              node.sectionHCm = v;
                              node.presetName = null;
                            });
                            onChanged();
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                ],
                OutlinedButton.icon(
                  onPressed: () {
                    setSheetState(() => node.exists = !node.exists);
                    onChanged();
                  },
                  icon: Icon(node.exists ? Icons.delete_outline : Icons.restore, size: 16, color: AppColors.danger),
                  label: Text(
                    node.exists ? "Supprimer ce poteau" : "Rétablir ce poteau",
                    style: const TextStyle(color: AppColors.danger),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _openEdgeSheet(BuildContext context, EdgeSelection selection) {
    final floor = building.currentFloor;
    final edge = floor.edgeAt(selection.key);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          final category = edge.type == EdgeType.poutre ? PresetCategory.poutre : PresetCategory.voile;
          final presets = building.presets[category]!;
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(edgeLabel(selection.key, edge.type), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                SegmentedChips<EdgeType>(
                  label: "Type",
                  options: EdgeType.values,
                  optionLabel: (t) => t.label,
                  value: edge.type,
                  onChanged: (v) {
                    setSheetState(() {
                      edge.type = v;
                      edge.presetName = null;
                    });
                    onChanged();
                  },
                ),
                if (edge.exists) ...[
                  const SizedBox(height: 16),
                  if (presets.isNotEmpty)
                    PickerField(
                      label: "Dimension type",
                      value: edge.presetName ?? "Personnalisé",
                      options: [...presets.map((p) => p.name), "Personnalisé"],
                      onChanged: (v) {
                        setSheetState(() {
                          if (v == "Personnalisé") {
                            edge.presetName = null;
                          } else {
                            final preset = presets.firstWhere((p) => p.name == v);
                            edge.presetName = v;
                            edge.sectionBCm = preset.aCm;
                            edge.sectionHCm = preset.bCm ?? preset.aCm;
                          }
                        });
                        onChanged();
                      },
                    ),
                  const SizedBox(height: 14),
                  if (edge.type == EdgeType.voile)
                    NumberField(
                      label: "Épaisseur",
                      unit: "cm",
                      value: edge.sectionBCm,
                      min: 10,
                      onChanged: (v) {
                        setSheetState(() {
                          edge.sectionBCm = v;
                          edge.presetName = null;
                        });
                        onChanged();
                      },
                    )
                  else
                    Row(
                      children: [
                        Expanded(
                          child: NumberField(
                            label: "Section b",
                            unit: "cm",
                            value: edge.sectionBCm,
                            min: 10,
                            onChanged: (v) {
                              setSheetState(() {
                                edge.sectionBCm = v;
                                edge.presetName = null;
                              });
                              onChanged();
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: NumberField(
                            label: "Section h",
                            unit: "cm",
                            value: edge.sectionHCm,
                            min: 10,
                            onChanged: (v) {
                              setSheetState(() {
                                edge.sectionHCm = v;
                                edge.presetName = null;
                              });
                              onChanged();
                            },
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 18),
                ],
                OutlinedButton.icon(
                  onPressed: () {
                    setSheetState(() => edge.exists = !edge.exists);
                    onChanged();
                  },
                  icon: Icon(edge.exists ? Icons.delete_outline : Icons.restore, size: 16, color: AppColors.danger),
                  label: Text(
                    edge.exists ? "Supprimer ce tronçon" : "Rétablir ce tronçon",
                    style: const TextStyle(color: AppColors.danger),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _openPanelSheet(BuildContext context, PanelSelection selection) {
    final floor = building.currentFloor;
    final panel = floor.panelAt(selection.col, selection.row);
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
                  Text("Panneau ${panel.romanLabel}", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  TextFormField(
                    initialValue: panel.customLabel ?? "",
                    decoration: const InputDecoration(isDense: true, labelText: "Nom (optionnel)"),
                    onChanged: (v) {
                      panel.customLabel = v.isEmpty ? null : v;
                      onChanged();
                    },
                  ),
                  if (panel.exists) ...[
                    const SizedBox(height: 16),
                    PickerField(
                      label: "Type de dalle",
                      value: panel.slabTypeId,
                      options: slabTypes.map((s) => s.id).toList(),
                      optionLabel: (id) => slabTypes.firstWhere((s) => s.id == id).label,
                      onChanged: (v) {
                        setSheetState(() => panel.slabTypeId = v);
                        onChanged();
                      },
                    ),
                    if (panel.slabType.isDallePleine) ...[
                      const SizedBox(height: 14),
                      NumberField(
                        label: "Épaisseur de la dalle",
                        unit: "m",
                        value: panel.slabThicknessM,
                        min: 0.05,
                        onChanged: (v) {
                          setSheetState(() => panel.slabThicknessM = v);
                          onChanged();
                        },
                      ),
                    ],
                    const SizedBox(height: 14),
                    PickerField(
                      label: "Usage (EC1)",
                      value: panel.usageId,
                      options: usageCategories.map((u) => u.id).toList(),
                      optionLabel: (id) {
                        final u = usageCategories.firstWhere((u) => u.id == id);
                        return "${u.id} — ${u.label}";
                      },
                      onChanged: (v) {
                        setSheetState(() => panel.usageId = v);
                        onChanged();
                      },
                    ),
                    const SizedBox(height: 16),
                    const Text("Revêtements", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    const SizedBox(height: 8),
                    for (final slot in panel.coatings)
                      CoatingRow(
                        key: ValueKey(slot.id),
                        coating: slot.coating,
                        onChanged: (c) {
                          setSheetState(() => slot.coating = c);
                          onChanged();
                        },
                        onRemove: () {
                          setSheetState(() => panel.coatings.remove(slot));
                          onChanged();
                        },
                      ),
                    OutlinedButton.icon(
                      onPressed: () {
                        setSheetState(() => panel.coatings.add(CoatingSlot(const Coating(name: "Revêtement", loadKnM2: 0.2))));
                        onChanged();
                      },
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text("Ajouter un revêtement"),
                    ),
                    const SizedBox(height: 18),
                  ],
                  OutlinedButton.icon(
                    onPressed: () {
                      setSheetState(() => panel.exists = !panel.exists);
                      onChanged();
                    },
                    icon: Icon(panel.exists ? Icons.delete_outline : Icons.restore, size: 16, color: AppColors.danger),
                    label: Text(
                      panel.exists ? "Supprimer ce panneau" : "Rétablir ce panneau",
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _FloorBar extends StatelessWidget {
  const _FloorBar({required this.building, required this.onChanged});

  final BuildingState building;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
      child: Row(
        children: [
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (var i = 0; i < building.floors.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(building.floors[i].label),
                        selected: building.currentFloorIndex == i,
                        onSelected: (_) {
                          building.currentFloorIndex = i;
                          building.selection = null;
                          onChanged();
                        },
                      ),
                    ),
                ],
              ),
            ),
          ),
          IconButton(
            tooltip: "Ajouter un étage",
            icon: const Icon(Icons.add_circle_outline, size: 20),
            onPressed: () {
              building.addFloor();
              onChanged();
            },
          ),
          IconButton(
            tooltip: "Dupliquer cet étage",
            icon: const Icon(Icons.copy_all_outlined, size: 20),
            onPressed: building.floors.length < 2 ? null : () => _pickDuplicateTarget(context),
          ),
        ],
      ),
    );
  }

  void _pickDuplicateTarget(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 18, 20, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text("Dupliquer vers…", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
            for (var i = 0; i < building.floors.length; i++)
              if (i != building.currentFloorIndex)
                ListTile(
                  title: Text(building.floors[i].label),
                  onTap: () {
                    building.duplicateCurrentFloorTo(i);
                    onChanged();
                    Navigator.of(sheetContext).pop();
                  },
                ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _GridSummaryBar extends StatelessWidget {
  const _GridSummaryBar({required this.floor, required this.onEdit});

  final FloorModel floor;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
      child: Row(
        children: [
          Expanded(
            child: Text(
              "${floor.nx} × ${floor.ny} travées · h = ${floor.heightM.toStringAsFixed(2)} m",
              style: AppTheme.monoTextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ),
          TextButton.icon(
            onPressed: onEdit,
            icon: const Icon(Icons.edit_outlined, size: 15),
            label: const Text("Grille"),
          ),
        ],
      ),
    );
  }
}

class _SelectedElementBar extends StatelessWidget {
  const _SelectedElementBar({required this.building, required this.onChanged, required this.onModify});

  final BuildingState building;
  final VoidCallback onChanged;
  final VoidCallback onModify;

  @override
  Widget build(BuildContext context) {
    final selection = building.selection!;
    final floor = building.currentFloor;
    final label = switch (selection) {
      NodeSelection(:final col, :final row) => "Poteau ${nodeLabel(col, row)}",
      EdgeSelection(:final key) => edgeLabel(key, floor.edges[key]?.type ?? EdgeType.poutre),
      PanelSelection(:final col, :final row) => "Panneau ${floor.panels[(col, row)]?.displayLabel ?? ''}",
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(color: AppColors.surface, border: Border(top: BorderSide(color: AppColors.border))),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
          TextButton(onPressed: onModify, child: const Text("Modifier")),
          IconButton(
            icon: const Icon(Icons.close, size: 18, color: AppColors.textTertiary),
            onPressed: () {
              building.selection = null;
              onChanged();
            },
          ),
        ],
      ),
    );
  }
}

// --- Step 2: Vent EC1 ------------------------------------------------------

class _StepVent extends StatelessWidget {
  const _StepVent({required this.building, required this.onChanged});

  final BuildingState building;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "Vent EC1, appliqué globalement au bâtiment (mêmes paramètres que le voile isolé).",
            style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 16),
          PickerField(
            label: "Zone de vent",
            value: building.ventZone,
            options: _zoneOptions,
            onChanged: (v) {
              building.ventZone = v;
              onChanged();
            },
          ),
          const SizedBox(height: 14),
          TextFormField(
            initialValue: building.ventRegion,
            decoration: const InputDecoration(isDense: true, labelText: "Région"),
            onChanged: (v) {
              building.ventRegion = v;
              onChanged();
            },
          ),
          const SizedBox(height: 14),
          PickerField(
            label: "Catégorie de terrain",
            value: building.ventTerrain,
            options: _terrainOptions,
            onChanged: (v) {
              building.ventTerrain = v;
              onChanged();
            },
          ),
          const SizedBox(height: 14),
          SegmentedChips<int>(
            label: "Direction du vent",
            options: _directionOptions,
            optionLabel: (d) => "$d°",
            value: building.ventDirection,
            onChanged: (v) {
              building.ventDirection = v;
              onChanged();
            },
          ),
        ],
      ),
    );
  }
}

// --- Step 3: Résultats ------------------------------------------------------

class _StepResultats extends StatefulWidget {
  const _StepResultats({required this.building, required this.onChanged});

  final BuildingState building;
  final VoidCallback onChanged;

  @override
  State<_StepResultats> createState() => _StepResultatsState();
}

class _StepResultatsState extends State<_StepResultats> with SingleTickerProviderStateMixin {
  late final _tabController = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final building = widget.building;
    final floor = building.currentFloor;
    final beamLoads = computeBeamGridLoads(
      spanXM: floor.spanXM,
      spanYM: floor.spanYM,
      panels: {
        for (final entry in floor.panels.entries)
          if (entry.value.exists)
            entry.key: BeamPanelInput(
              mode: PanelMode.complet,
              pressureEluKnM2: entry.value.pressureEluKnM2,
              pressureElsKnM2: entry.value.pressureElsKnM2,
            ),
      },
    );

    return Column(
      children: [
        _FloorBar(building: building, onChanged: widget.onChanged),
        // Proportional, not a fixed pixel height — a fixed SizedBox here
        // previously overflowed on short viewports (e.g. the default test
        // surface), since it didn't shrink to make room for the TabBar and
        // FloorBar above it.
        Expanded(
          flex: 2,
          child: BuildingPlanCanvas(
            floor: floor,
            selection: building.selection,
            onSelect: (s) {
              building.selection = s;
              widget.onChanged();
            },
          ),
        ),
        TabBar(
          controller: _tabController,
          labelColor: AppColors.accentBlue,
          unselectedLabelColor: AppColors.textTertiary,
          tabs: const [Tab(text: "Poteaux"), Tab(text: "Poutres"), Tab(text: "Voiles")],
        ),
        Expanded(
          flex: 3,
          child: TabBarView(
            controller: _tabController,
            children: [
              _PoteauResultsTable(floor: floor),
              _EdgeResultsTable(floor: floor, beamLoads: beamLoads, type: EdgeType.poutre),
              _EdgeResultsTable(floor: floor, beamLoads: beamLoads, type: EdgeType.voile),
            ],
          ),
        ),
      ],
    );
  }
}

class _PoteauResultsTable extends StatelessWidget {
  const _PoteauResultsTable({required this.floor});

  final FloorModel floor;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, double)>[];
    for (var c = 0; c <= floor.nx; c++) {
      for (var r = 0; r <= floor.ny; r++) {
        if (!(floor.nodes[(c, r)]?.exists ?? true)) continue;
        final area = nodeTributaryAreaM2(spanXM: floor.spanXM, spanYM: floor.spanYM, colIndex: c, rowIndex: r);
        final adjacent = _adjacentPanels(floor, c, r);
        if (adjacent.isEmpty) continue;
        final avgG = adjacent.map((p) => p.gDalleKnM2 + p.gRevKnM2).reduce((a, b) => a + b) / adjacent.length;
        final avgQ = adjacent.map((p) => p.qKnM2).reduce((a, b) => a + b) / adjacent.length;
        final nElu = eluCombination(gKn: avgG * area, qKn: avgQ * area);
        rows.add((nodeLabel(c, r), nElu));
      }
    }
    return _ResultsTable(rows: rows, emptyMessage: "Aucun poteau chargé sur cet étage.");
  }

  static List<BuildingPanelSlot> _adjacentPanels(FloorModel floor, int col, int row) {
    final result = <BuildingPanelSlot>[];
    for (final (dc, dr) in const [(-1, -1), (0, -1), (-1, 0), (0, 0)]) {
      final c = col + dc;
      final r = row + dr;
      if (c < 0 || c >= floor.nx || r < 0 || r >= floor.ny) continue;
      final panel = floor.panels[(c, r)];
      if (panel != null && panel.exists) result.add(panel);
    }
    return result;
  }
}

class _EdgeResultsTable extends StatelessWidget {
  const _EdgeResultsTable({required this.floor, required this.beamLoads, required this.type});

  final FloorModel floor;
  final Map<BeamKey, BeamLoadResult> beamLoads;
  final EdgeType type;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, double)>[];
    for (final entry in beamLoads.entries) {
      final edge = floor.edges[entry.key];
      final edgeType = edge?.type ?? EdgeType.poutre;
      final exists = edge?.exists ?? true;
      if (!exists || edgeType != type) continue;
      rows.add((edgeLabel(entry.key, edgeType), entry.value.qEluKnM));
    }
    return _ResultsTable(
      rows: rows,
      emptyMessage: type == EdgeType.poutre ? "Aucune poutre chargée sur cet étage." : "Aucun voile chargé sur cet étage.",
      valueLabel: "q_ELU (kN/m)",
    );
  }
}

class _ResultsTable extends StatelessWidget {
  const _ResultsTable({required this.rows, required this.emptyMessage, this.valueLabel = "N_ELU (kN)"});

  final List<(String, double)> rows;
  final String emptyMessage;
  final String valueLabel;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(emptyMessage, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12.5, color: AppColors.textTertiary)),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                Expanded(child: Text(row.$1, style: const TextStyle(fontSize: 13))),
                Text(row.$2.toStringAsFixed(2), style: AppTheme.monoTextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        const SizedBox(height: 8),
        Text(valueLabel, style: const TextStyle(fontSize: 10.5, color: AppColors.textTertiary)),
      ],
    );
  }
}

// --- Dimension preset manager -----------------------------------------------

class _PresetManagerDialog extends StatefulWidget {
  const _PresetManagerDialog({required this.building, required this.onChanged});

  final BuildingState building;
  final VoidCallback onChanged;

  @override
  State<_PresetManagerDialog> createState() => _PresetManagerDialogState();
}

class _PresetManagerDialogState extends State<_PresetManagerDialog> {
  PresetCategory _category = PresetCategory.poteau;
  final _nameController = TextEditingController();
  final _aController = TextEditingController(text: "25");
  final _bController = TextEditingController(text: "40");

  @override
  void dispose() {
    _nameController.dispose();
    _aController.dispose();
    _bController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final presets = widget.building.presets[_category]!;
    final isVoile = _category == PresetCategory.voile;

    return AlertDialog(
      backgroundColor: AppColors.surface,
      title: const Text("Dimensions types"),
      content: SizedBox(
        width: 340,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SegmentedChips<PresetCategory>(
              label: "Catégorie",
              options: PresetCategory.values,
              optionLabel: (c) => c.label,
              value: _category,
              onChanged: (v) => setState(() => _category = v),
            ),
            const SizedBox(height: 14),
            if (presets.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text("Aucune dimension type pour cette catégorie.", style: TextStyle(fontSize: 12, color: AppColors.textTertiary)),
              )
            else
              for (final preset in presets)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(preset.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    preset.bCm != null ? "${preset.aCm.toStringAsFixed(0)} × ${preset.bCm!.toStringAsFixed(0)} cm" : "${preset.aCm.toStringAsFixed(0)} cm",
                    style: AppTheme.monoTextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.close, size: 16, color: AppColors.textTertiary),
                    onPressed: () {
                      setState(() => presets.remove(preset));
                      widget.onChanged();
                    },
                  ),
                ),
            const Divider(height: 24),
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _nameController,
                    decoration: const InputDecoration(isDense: true, hintText: "Nom (ex. PTR30_40)"),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _aController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(isDense: true, labelText: isVoile ? "Épaisseur (cm)" : "b (cm)"),
                  ),
                ),
                if (!isVoile) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _bController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(isDense: true, labelText: "h (cm)"),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _addPreset,
              icon: const Icon(Icons.add, size: 16),
              label: const Text("Ajouter"),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text("Fermer")),
      ],
    );
  }

  void _addPreset() {
    final name = _nameController.text.trim();
    final a = double.tryParse(_aController.text);
    if (name.isEmpty || a == null) return;
    final b = _category == PresetCategory.voile ? null : double.tryParse(_bController.text);
    setState(() {
      widget.building.presets[_category]!.add(DimensionPreset(name: name, aCm: a, bCm: b));
      _nameController.clear();
    });
    widget.onChanged();
  }
}
