import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../state/app_scope.dart";
import "../../state/presets.dart";
import "../../state/saved_project.dart";
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
  const BuildingFlowScreen({super.key, this.initialProject});

  /// Reopens a project saved earlier from the dashboard's "Projets
  /// récents" instead of starting from a blank building.
  final SavedProject? initialProject;

  @override
  State<BuildingFlowScreen> createState() => _BuildingFlowScreenState();
}

class _BuildingFlowScreenState extends State<BuildingFlowScreen> {
  late final _building = widget.initialProject != null
      ? BuildingState.fromJson(widget.initialProject!.data)
      : BuildingState();
  late final _projectId = widget.initialProject?.id ?? DateTime.now().millisecondsSinceEpoch.toString();
  late String _projectName = widget.initialProject?.name ?? "Bâtiment sans nom";
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
            tooltip: "Enregistrer le projet",
            icon: const Icon(Icons.save_outlined),
            onPressed: () => _openSaveDialog(context),
          ),
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
      builder: (dialogContext) => _PresetManagerDialog(onChanged: _onChanged),
    );
  }

  void _openSaveDialog(BuildContext context) {
    final controller = TextEditingController(text: _projectName);
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text("Enregistrer le projet"),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(isDense: true, labelText: "Nom du projet"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text("Annuler")),
          FilledButton(
            onPressed: () {
              final name = controller.text.trim();
              setState(() => _projectName = name.isEmpty ? _projectName : name);
              AppScope.of(context).saveProject(
                id: _projectId,
                type: SavedProjectType.batiment,
                name: _projectName,
                data: _building.toJson(),
              );
              Navigator.of(dialogContext).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text("Projet « $_projectName » enregistré")),
              );
            },
            child: const Text("Enregistrer"),
          ),
        ],
      ),
    );
  }
}

// --- Step 1: Modélisation ------------------------------------------------

class _StepModelisation extends StatefulWidget {
  const _StepModelisation({required this.building, required this.onChanged});

  final BuildingState building;
  final VoidCallback onChanged;

  @override
  State<_StepModelisation> createState() => _StepModelisationState();
}

class _StepModelisationState extends State<_StepModelisation> {
  ObliquePlacementMode _placementMode = ObliquePlacementMode.none;
  Offset? _pendingFirstPointM;

  BuildingState get building => widget.building;
  VoidCallback get onChanged => widget.onChanged;

  void _cancelPlacement() => setState(() {
        _placementMode = ObliquePlacementMode.none;
        _pendingFirstPointM = null;
      });

  void _onPlacementTap(Offset pointM) {
    switch (_placementMode) {
      case ObliquePlacementMode.beamFirstPoint:
        setState(() {
          _pendingFirstPointM = pointM;
          _placementMode = ObliquePlacementMode.beamSecondPoint;
        });
        break;
      case ObliquePlacementMode.beamSecondPoint:
        final first = _pendingFirstPointM!;
        final beam = ObliqueBeam(
          id: "ob${DateTime.now().microsecondsSinceEpoch}",
          x1M: first.dx,
          y1M: first.dy,
          x2M: pointM.dx,
          y2M: pointM.dy,
        );
        building.currentFloor.obliqueBeams.add(beam);
        building.selection = ObliqueBeamSelection(beam.id);
        _cancelPlacement();
        onChanged();
        break;
      case ObliquePlacementMode.poteau:
        final poteau = ObliquePoteau(id: "op${DateTime.now().microsecondsSinceEpoch}", xM: pointM.dx, yM: pointM.dy);
        building.currentFloor.obliquePoteaux.add(poteau);
        building.selection = ObliquePoteauSelection(poteau.id);
        _cancelPlacement();
        onChanged();
        break;
      case ObliquePlacementMode.none:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final floor = building.currentFloor;
    return Column(
      children: [
        _FloorBar(building: building, onChanged: onChanged),
        _GridSummaryBar(floor: floor, onEdit: () => _openGridSheet(context)),
        _ObliqueToolbar(
          mode: _placementMode,
          onStartBeam: () => setState(() {
            _placementMode = ObliquePlacementMode.beamFirstPoint;
            building.selection = null;
          }),
          onStartPoteau: () => setState(() {
            _placementMode = ObliquePlacementMode.poteau;
            building.selection = null;
          }),
          onCancel: _cancelPlacement,
        ),
        Expanded(
          child: BuildingPlanCanvas(
            floor: floor,
            selection: building.selection,
            onSelect: (s) {
              building.selection = s;
              onChanged();
            },
            placementMode: _placementMode,
            pendingFirstPointM: _pendingFirstPointM,
            onPlacementTap: _onPlacementTap,
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
                  Text("Portées X", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
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
                  Text("Portées Y", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
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
      case ObliqueBeamSelection():
        _openObliqueBeamSheet(context, selection);
        break;
      case ObliquePoteauSelection():
        _openObliquePoteauSheet(context, selection);
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
          final presets = AppScope.of(sheetContext).presets[PresetCategory.poteau]!;
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Poteau ${nodeLabel(selection.col, selection.row)}", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                if (node.exists) ...[
                  _DimensionTypeRow(
                    category: PresetCategory.poteau,
                    presetName: node.presetName,
                    setSheetState: setSheetState,
                    onApply: (v) {
                      setSheetState(() {
                        if (v == null) {
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
                    onChanged: onChanged,
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
          final presets = AppScope.of(sheetContext).presets[category]!;
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
                  _DimensionTypeRow(
                    category: category,
                    presetName: edge.presetName,
                    setSheetState: setSheetState,
                    onApply: (v) {
                      setSheetState(() {
                        if (v == null) {
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
                    onChanged: onChanged,
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
                    Text("Revêtements", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
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
                    _PanelGroupingSection(
                      floor: floor,
                      col: selection.col,
                      row: selection.row,
                      setSheetState: setSheetState,
                      onChanged: onChanged,
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

  void _openObliqueBeamSheet(BuildContext context, ObliqueBeamSelection selection) {
    final floor = building.currentFloor;
    final beam = floor.obliqueBeams.firstWhere((b) => b.id == selection.id);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("Poutre oblique", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(
                  "Longueur ${(Offset(beam.x2M, beam.y2M) - Offset(beam.x1M, beam.y1M)).distance.toStringAsFixed(2)} m",
                  style: TextStyle(fontSize: 12, color: AppColors.textTertiary),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: NumberField(
                        label: "Section b",
                        unit: "cm",
                        value: beam.sectionBCm,
                        min: 10,
                        onChanged: (v) {
                          setSheetState(() => beam.sectionBCm = v);
                          onChanged();
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: NumberField(
                        label: "Section h",
                        unit: "cm",
                        value: beam.sectionHCm,
                        min: 10,
                        onChanged: (v) {
                          setSheetState(() => beam.sectionHCm = v);
                          onChanged();
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                OutlinedButton.icon(
                  onPressed: () {
                    floor.obliqueBeams.removeWhere((b) => b.id == beam.id);
                    building.selection = null;
                    Navigator.of(sheetContext).pop();
                    onChanged();
                  },
                  icon: const Icon(Icons.delete_outline, size: 16, color: AppColors.danger),
                  label: const Text("Supprimer cette poutre", style: TextStyle(color: AppColors.danger)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _openObliquePoteauSheet(BuildContext context, ObliquePoteauSelection selection) {
    final floor = building.currentFloor;
    final poteau = floor.obliquePoteaux.firstWhere((p) => p.id == selection.id);
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
                  const Text("Poteau oblique", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                    "Positionné librement — hors grille, donc l'aire tributaire et les charges se saisissent directement.",
                    style: TextStyle(fontSize: 11.5, color: AppColors.textTertiary, height: 1.35),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: NumberField(
                          label: "Section b",
                          unit: "cm",
                          value: poteau.sectionBCm,
                          min: 10,
                          onChanged: (v) {
                            setSheetState(() => poteau.sectionBCm = v);
                            onChanged();
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: NumberField(
                          label: "Section h",
                          unit: "cm",
                          value: poteau.sectionHCm,
                          min: 10,
                          onChanged: (v) {
                            setSheetState(() => poteau.sectionHCm = v);
                            onChanged();
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  NumberField(
                    label: "Aire tributaire",
                    unit: "m²",
                    value: poteau.aireTributaireM2,
                    min: 0.1,
                    onChanged: (v) {
                      setSheetState(() => poteau.aireTributaireM2 = v);
                      onChanged();
                    },
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: NumberField(
                          label: "G (permanent)",
                          unit: "kN/m²",
                          value: poteau.gKnM2,
                          min: 0,
                          onChanged: (v) {
                            setSheetState(() => poteau.gKnM2 = v);
                            onChanged();
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: NumberField(
                          label: "Q (exploitation)",
                          unit: "kN/m²",
                          value: poteau.qKnM2,
                          min: 0,
                          onChanged: (v) {
                            setSheetState(() => poteau.qKnM2 = v);
                            onChanged();
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceRaised,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        Expanded(child: Text("N_ELU", style: TextStyle(fontSize: 12.5, color: AppColors.textSecondary))),
                        Text(
                          "${poteau.nEluKn.toStringAsFixed(1)} kN",
                          style: AppTheme.monoTextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.accentBlue),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  OutlinedButton.icon(
                    onPressed: () {
                      floor.obliquePoteaux.removeWhere((p) => p.id == poteau.id);
                      building.selection = null;
                      Navigator.of(sheetContext).pop();
                      onChanged();
                    },
                    icon: const Icon(Icons.delete_outline, size: 16, color: AppColors.danger),
                    label: const Text("Supprimer ce poteau", style: TextStyle(color: AppColors.danger)),
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

/// Lets the user merge (col,row) with an adjacent panel once the beam that
/// used to separate them was deleted — spec follow-up: "si 2 panneaux sont
/// collés sans une poutre au milieu, on ait la possibilité de les grouper /
/// dégrouper". Shows nothing when there's genuinely no beamless neighbour
/// and the panel isn't already grouped, so it doesn't clutter the sheet for
/// the common (non-adjacent-to-a-gap) case.
class _PanelGroupingSection extends StatelessWidget {
  const _PanelGroupingSection({
    required this.floor,
    required this.col,
    required this.row,
    required this.setSheetState,
    required this.onChanged,
  });

  final FloorModel floor;
  final int col;
  final int row;
  final StateSetter setSheetState;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final panel = floor.panelAt(col, row);
    final members = floor.groupMembers(col, row);
    final isGrouped = panel.groupId != null;
    final candidates = floor.ungroupedNeighbors(col, row).where((m) => !members.contains(m)).toList();

    if (!isGrouped && candidates.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Groupement", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        const SizedBox(height: 8),
        if (isGrouped)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.accentTeal.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.accentTeal.withValues(alpha: 0.4)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    "Groupé avec ${members.length - 1} autre${members.length - 1 > 1 ? 's' : ''} panneau${members.length - 1 > 1 ? 'x' : ''}",
                    style: const TextStyle(fontSize: 12.5),
                  ),
                ),
                TextButton(
                  onPressed: () {
                    setSheetState(() => floor.ungroupPanel(col, row));
                    onChanged();
                  },
                  child: const Text("Dégrouper"),
                ),
              ],
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (nc, nr) in candidates)
                OutlinedButton.icon(
                  onPressed: () {
                    setSheetState(() => floor.groupPanels(col, row, nc, nr));
                    onChanged();
                  },
                  icon: const Icon(Icons.call_merge, size: 15),
                  label: Text("Grouper avec ${floor.panelOrDefault(nc, nr).displayLabel}"),
                ),
            ],
          ),
      ],
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
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
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
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
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

/// Arms/cancels placing an oblique beam or poteau (spec follow-up: "poutres
/// obliques ... et des poteaux suivant l'axe de ces poutres ou en position
/// normale") — the orthogonal grid stays exactly as it is; these are drawn
/// as a free overlay on top of it, so nothing about the grid's own
/// automatic tributary-area/load calculation is affected.
class _ObliqueToolbar extends StatelessWidget {
  const _ObliqueToolbar({
    required this.mode,
    required this.onStartBeam,
    required this.onStartPoteau,
    required this.onCancel,
  });

  final ObliquePlacementMode mode;
  final VoidCallback onStartBeam;
  final VoidCallback onStartPoteau;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final hint = switch (mode) {
      ObliquePlacementMode.beamFirstPoint => "Touchez le 1ᵉʳ point de la poutre oblique",
      ObliquePlacementMode.beamSecondPoint => "Touchez le 2ᵉ point de la poutre oblique",
      ObliquePlacementMode.poteau => "Touchez l'emplacement du poteau",
      ObliquePlacementMode.none => null,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
      child: hint == null
          ? Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onStartBeam,
                    icon: const Icon(Icons.trending_up, size: 15),
                    label: const Text("Poutre oblique"),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onStartPoteau,
                    icon: const Icon(Icons.add_box_outlined, size: 15),
                    label: const Text("Poteau oblique"),
                  ),
                ),
              ],
            )
          : Row(
              children: [
                Expanded(
                  child: Text(hint, style: const TextStyle(fontSize: 12.5, color: AppColors.accentBlue, fontWeight: FontWeight.w600)),
                ),
                TextButton(onPressed: onCancel, child: const Text("Annuler")),
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
      ObliqueBeamSelection() => "Poutre oblique",
      ObliquePoteauSelection() => "Poteau oblique",
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(color: AppColors.surface, border: Border(top: BorderSide(color: AppColors.border))),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
          TextButton(onPressed: onModify, child: const Text("Modifier")),
          IconButton(
            icon: Icon(Icons.close, size: 18, color: AppColors.textTertiary),
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
          Text(
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
  late final _tabController = TabController(length: 3, vsync: this)..addListener(_onTabChanged);

  // The collapsed sheet's handle + tab bar need about this much room —
  // computing the minimum size as a fraction of the *actual* available
  // height (see build()) instead of a fixed fraction keeps it from
  // RenderFlex-overflowing on a short viewport, where a flat fraction like
  // 0.20 can resolve to fewer pixels than the content needs.
  static const _collapsedContentPx = 92.0;

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    // TabBar alone (no TabBarView) doesn't rebuild anything on its own —
    // the currently-shown tab's rows are picked in build() from
    // _tabController.index, so a tap needs an explicit rebuild here.
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final building = widget.building;
    final floor = building.currentFloor;
    // A cell the user never tapped still defaults to an existing slab panel
    // (see FloorModel.panelOrDefault) — iterating the whole grid instead of
    // floor.panels.entries makes sure it still loads its bordering beams
    // instead of silently contributing nothing.
    final panelInputs = <(int, int), BeamPanelInput>{};
    for (var c = 0; c < floor.nx; c++) {
      for (var r = 0; r < floor.ny; r++) {
        final panel = floor.panelOrDefault(c, r);
        if (!panel.exists) continue;
        panelInputs[(c, r)] = BeamPanelInput(
          mode: PanelMode.complet,
          pressureEluKnM2: panel.pressureEluKnM2,
          pressureElsKnM2: panel.pressureElsKnM2,
        );
      }
    }
    final beamLoads = computeBeamGridLoads(spanXM: floor.spanXM, spanYM: floor.spanYM, panels: panelInputs);

    return Column(
      children: [
        _FloorBar(building: building, onChanged: widget.onChanged),
        // The plan fills the whole remaining area; the results panel is a
        // draggable sheet over it (starts collapsed to a handle + tab bar
        // so the plan and its surfaces d'influence stay fully visible,
        // and can be pulled up to read the tables) instead of a fixed
        // Column split that permanently ate into the plan's space.
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final minFraction = (_collapsedContentPx / constraints.maxHeight).clamp(0.10, 0.4).toDouble();
              final snaps = [minFraction, 0.5, 0.85];
              return Stack(
                children: [
                  Positioned.fill(
                    child: BuildingPlanCanvas(
                      floor: floor,
                      selection: building.selection,
                      onSelect: (s) {
                        building.selection = s;
                        widget.onChanged();
                      },
                      showInfluenceSurfaces: true,
                      beamLoads: beamLoads,
                    ),
                  ),
                  DraggableScrollableSheet(
                    initialChildSize: minFraction,
                    minChildSize: minFraction,
                    maxChildSize: snaps.last,
                    snap: true,
                    snapSizes: snaps,
                    builder: (sheetContext, scrollController) {
                      final tabContent = switch (_tabController.index) {
                        1 => _EdgeResultsTable(floor: floor, beamLoads: beamLoads, type: EdgeType.poutre),
                        2 => _EdgeResultsTable(floor: floor, beamLoads: beamLoads, type: EdgeType.voile),
                        _ => _PoteauResultsTable(floor: floor),
                      };
                      return DecoratedBox(
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                          boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 16, offset: Offset(0, -3))],
                        ),
                        // A single Scrollable using the builder's own
                        // scrollController — this, not a hand-rolled drag
                        // gesture, is what lets DraggableScrollableSheet
                        // convert a drag into resizing (via its scroll
                        // notifications); nesting a second scrollable per
                        // tab (e.g. TabBarView's own pages) breaks that,
                        // which is why the sheet didn't respond to a real
                        // drag before.
                        child: SingleChildScrollView(
                          controller: scrollController,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                key: const Key("resultsSheetHandle"),
                                height: 24,
                                alignment: Alignment.center,
                                child: Container(
                                  width: 36,
                                  height: 4,
                                  decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
                                ),
                              ),
                              TabBar(
                                controller: _tabController,
                                labelColor: AppColors.accentBlue,
                                unselectedLabelColor: AppColors.textTertiary,
                                tabs: const [Tab(text: "Poteaux"), Tab(text: "Poutres"), Tab(text: "Voiles")],
                              ),
                              tabContent,
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              );
            },
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
    for (final (i, poteau) in floor.obliquePoteaux.indexed) {
      rows.add(("Poteau oblique ${i + 1}", poteau.nEluKn));
    }
    return _ResultsTable(rows: rows, emptyMessage: "Aucun poteau chargé sur cet étage.");
  }

  static List<BuildingPanelSlot> _adjacentPanels(FloorModel floor, int col, int row) {
    final result = <BuildingPanelSlot>[];
    for (final (dc, dr) in const [(-1, -1), (0, -1), (-1, 0), (0, 0)]) {
      final c = col + dc;
      final r = row + dr;
      if (c < 0 || c >= floor.nx || r < 0 || r >= floor.ny) continue;
      final panel = floor.panelOrDefault(c, r);
      if (panel.exists) result.add(panel);
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

  // Plain content, not its own scrollable — it's spliced into the
  // Résultats sheet's single outer SingleChildScrollView (see
  // _StepResultatsState.build()) so the whole sheet, header included,
  // shares one Scrollable wired to the sheet's own scrollController. A
  // second, independent scrollable per tab is exactly what stopped the
  // sheet's built-in drag-to-resize from working — DraggableScrollableSheet
  // only converts drag into resizing via scroll notifications on a
  // Scrollable that uses its builder's scrollController.
  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Text(emptyMessage, textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: AppColors.textTertiary)),
      );
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
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
          Align(
            alignment: Alignment.centerLeft,
            child: Text(valueLabel, style: TextStyle(fontSize: 10.5, color: AppColors.textTertiary)),
          ),
        ],
      ),
    );
  }
}

/// "Dimension type" picker for a node/edge sheet, plus an inline "+" to
/// create a new preset without leaving the sheet (spec §7: "un
/// gestionnaire... permet de créer des tailles nommées... et de les
/// appliquer en un clic"). Always visible — even with zero presets saved
/// yet, since that's exactly when the user needs the "+" most.
class _DimensionTypeRow extends StatelessWidget {
  const _DimensionTypeRow({
    required this.category,
    required this.presetName,
    required this.onApply,
    required this.onChanged,
    required this.setSheetState,
  });

  final PresetCategory category;
  final String? presetName;

  /// Called with the chosen preset's name, or null for "Personnalisé".
  final ValueChanged<String?> onApply;
  final VoidCallback onChanged;
  final StateSetter setSheetState;

  @override
  Widget build(BuildContext context) {
    final presets = AppScope.of(context).presets[category]!;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: presets.isEmpty
              ? Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    "Aucune dimension type enregistrée.",
                    style: TextStyle(fontSize: 11.5, color: AppColors.textTertiary),
                  ),
                )
              : PickerField(
                  label: "Dimension type",
                  value: presetName ?? "Personnalisé",
                  options: [...presets.map((p) => p.name), "Personnalisé"],
                  onChanged: (v) => onApply(v == "Personnalisé" ? null : v),
                ),
        ),
        const SizedBox(width: 8),
        IconButton(
          tooltip: "Nouvelle dimension type",
          icon: const Icon(Icons.add_box_outlined, color: AppColors.accentBlue),
          onPressed: () async {
            await showDialog<void>(
              context: context,
              builder: (dialogContext) => _PresetManagerDialog(onChanged: onChanged, initialCategory: category),
            );
            setSheetState(() {});
          },
        ),
      ],
    );
  }
}

// --- Dimension preset manager -----------------------------------------------

class _PresetManagerDialog extends StatefulWidget {
  const _PresetManagerDialog({
    required this.onChanged,
    this.initialCategory = PresetCategory.poteau,
  });

  final VoidCallback onChanged;
  final PresetCategory initialCategory;

  @override
  State<_PresetManagerDialog> createState() => _PresetManagerDialogState();
}

class _PresetManagerDialogState extends State<_PresetManagerDialog> {
  late PresetCategory _category = widget.initialCategory;
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
    final presets = AppScope.of(context).presets[_category]!;
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
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
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
                    icon: Icon(Icons.close, size: 16, color: AppColors.textTertiary),
                    onPressed: () {
                      AppScope.of(context).removePreset(_category, preset);
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
    AppScope.of(context).addPreset(_category, DimensionPreset(name: name, aCm: a, bCm: b));
    setState(() => _nameController.clear());
    widget.onChanged();
  }
}
