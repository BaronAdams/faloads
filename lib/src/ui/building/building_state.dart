import "../../domain/domain.dart";
import "../common/level_form_state.dart";

/// Named, reusable size presets per element category (spec §7: "un
/// gestionnaire... permet de créer des tailles nommées par catégorie
/// d'élément (ex. 'PTR30_40') et de les appliquer en un clic").
enum PresetCategory { poteau, poutre, voile }

extension PresetCategoryLabel on PresetCategory {
  String get label => switch (this) {
        PresetCategory.poteau => "Poteaux",
        PresetCategory.poutre => "Poutres",
        PresetCategory.voile => "Voiles",
      };
}

class DimensionPreset {
  DimensionPreset({required this.name, required this.aCm, this.bCm});

  String name;

  /// b (poteau/poutre) or épaisseur (voile).
  double aCm;

  /// h — only meaningful for poteau/poutre.
  double? bCm;
}

/// Roman numeral for slab-panel numbering (spec §7: "panneaux de dalle
/// désignés en chiffres romains I, II, III…").
String toRoman(int n) {
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const symbols = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
  var remaining = n;
  final buffer = StringBuffer();
  for (var i = 0; i < values.length; i++) {
    while (remaining >= values[i]) {
      buffer.write(symbols[i]);
      remaining -= values[i];
    }
  }
  return buffer.toString();
}

/// Spreadsheet-style column letter for vertical axes (spec §7: "axes
/// verticaux lettrés (A, B, C…)"). 0->A, 25->Z, 26->AA, ...
String columnLetter(int index) {
  var n = index;
  final letters = <String>[];
  do {
    letters.add(String.fromCharCode(65 + n % 26));
    n = n ~/ 26 - 1;
  } while (n >= 0);
  return letters.reversed.join();
}

enum EdgeType { poutre, voile }

extension EdgeTypeLabel on EdgeType {
  String get label => this == EdgeType.poutre ? "Poutre" : "Voile";
}

/// Poteau designation (spec §7 example: "1A") — row number + column letter.
String nodeLabel(int col, int row) => "${row + 1}${columnLetter(col)}";

/// Poutre/voile designation (spec §7 examples: "Poutre 2", "Poutre D") — the
/// row number for a horizontal edge, the column letter for a vertical one,
/// with the travée segment appended since a single row/column can hold
/// several independently-edited segments.
String edgeLabel(BeamKey key, EdgeType type) {
  final axis = key.isHorizontal ? "${key.line + 1}" : columnLetter(key.line);
  return "${type.label} $axis·${key.segment + 1}";
}

/// A grid node — a poteau, or nothing if [exists] is false (a removed
/// poteau, spec §7: "un tronçon supprimé devient un pointillé gris
/// re-cliquable pour être rétabli" — same idea applies to nodes here).
class NodeSlot {
  NodeSlot({this.exists = true, this.sectionBCm = 25, this.sectionHCm = 25, this.presetName});

  bool exists;
  double sectionBCm;
  double sectionHCm;
  String? presetName;
}

/// A grid edge — a poutre or a voile, or nothing if [exists] is false.
class EdgeSlot {
  EdgeSlot({
    this.exists = true,
    this.type = EdgeType.poutre,
    this.sectionBCm = 25,
    this.sectionHCm = 40,
    this.presetName,
  });

  bool exists;
  EdgeType type;
  double sectionBCm;
  double sectionHCm;
  String? presetName;
}

/// A slab panel — same catalogues as every other flow (dalle type, usage,
/// coatings), plus the renamable roman-numeral designation.
class BuildingPanelSlot {
  BuildingPanelSlot({
    this.exists = true,
    required this.romanLabel,
    this.customLabel,
    this.slabTypeId = "cc16",
    this.slabThicknessM = 0.16,
    this.usageId = "A",
  }) : coatings = [];

  bool exists;
  String romanLabel;
  String? customLabel;
  String slabTypeId;
  double slabThicknessM;
  String usageId;
  final List<CoatingSlot> coatings;

  String get displayLabel => customLabel ?? romanLabel;

  SlabType get slabType => slabTypes.firstWhere((s) => s.id == slabTypeId);
  UsageCategory get usage => usageCategories.firstWhere((u) => u.id == usageId);
  double get gDalleKnM2 => slabSelfWeight(slabType, thicknessM: slabThicknessM);
  double get gRevKnM2 => totalCoatingLoad(coatings.map((s) => s.coating).toList());
  double get qKnM2 => usage.qKnM2;
  double get pressureEluKnM2 => eluCombination(gKn: gDalleKnM2 + gRevKnM2, qKn: qKnM2);
  double get pressureElsKnM2 => elsCombination(gKn: gDalleKnM2 + gRevKnM2, qKn: qKnM2);
}

/// One floor's full modelling: grid spans, and every node/edge/panel slot
/// on it. Floors are otherwise independent, but [duplicate] lets the user
/// carry one floor's whole configuration to another (spec §7: "étages
/// dupliquables").
class FloorModel {
  FloorModel({required this.label, this.nx = 3, this.ny = 2, List<double>? spanXM, List<double>? spanYM})
      : spanXM = spanXM ?? List.filled(nx, 4.0),
        spanYM = spanYM ?? List.filled(ny, 4.0),
        nodes = {},
        edges = {},
        panels = {};

  String label;
  int nx;
  int ny;
  List<double> spanXM;
  List<double> spanYM;
  double heightM = 3.0;

  final Map<(int, int), NodeSlot> nodes;
  final Map<BeamKey, EdgeSlot> edges;
  final Map<(int, int), BuildingPanelSlot> panels;

  NodeSlot nodeAt(int col, int row) => nodes.putIfAbsent((col, row), NodeSlot.new);
  EdgeSlot edgeAt(BeamKey key) => edges.putIfAbsent(key, EdgeSlot.new);
  BuildingPanelSlot panelAt(int col, int row) => panels.putIfAbsent(
        (col, row),
        () => BuildingPanelSlot(romanLabel: toRoman(row * nx + col + 1)),
      );

  FloorModel duplicate(String newLabel) {
    final copy = FloorModel(label: newLabel, nx: nx, ny: ny, spanXM: List.of(spanXM), spanYM: List.of(spanYM));
    copy.heightM = heightM;
    for (final entry in nodes.entries) {
      final v = entry.value;
      copy.nodes[entry.key] = NodeSlot(exists: v.exists, sectionBCm: v.sectionBCm, sectionHCm: v.sectionHCm, presetName: v.presetName);
    }
    for (final entry in edges.entries) {
      final v = entry.value;
      copy.edges[entry.key] = EdgeSlot(
        exists: v.exists,
        type: v.type,
        sectionBCm: v.sectionBCm,
        sectionHCm: v.sectionHCm,
        presetName: v.presetName,
      );
    }
    for (final entry in panels.entries) {
      final v = entry.value;
      final panel = BuildingPanelSlot(
        exists: v.exists,
        romanLabel: v.romanLabel,
        customLabel: v.customLabel,
        slabTypeId: v.slabTypeId,
        slabThicknessM: v.slabThicknessM,
        usageId: v.usageId,
      );
      panel.coatings.addAll(v.coatings.map((s) => CoatingSlot(s.coating)));
      copy.panels[entry.key] = panel;
    }
    return copy;
  }
}

sealed class BuildingSelection {
  const BuildingSelection();
}

class NodeSelection extends BuildingSelection {
  const NodeSelection(this.col, this.row);
  final int col;
  final int row;
}

class EdgeSelection extends BuildingSelection {
  const EdgeSelection(this.key);
  final BeamKey key;
}

class PanelSelection extends BuildingSelection {
  const PanelSelection(this.col, this.row);
  final int col;
  final int row;
}

/// Top-level state for the bâtiment complet flow: every floor, the shared
/// dimension-preset registry, and the building-wide wind parameters
/// (spec §7: "Sous-étape Vent : mêmes paramètres EC1 que le Voile isolé").
class BuildingState {
  BuildingState() : floors = [FloorModel(label: "RDC")];

  final List<FloorModel> floors;
  int currentFloorIndex = 0;

  final Map<PresetCategory, List<DimensionPreset>> presets = {
    for (final c in PresetCategory.values) c: <DimensionPreset>[],
  };

  BuildingSelection? selection;

  String ventZone = "II";
  String ventRegion = "Intérieure";
  String ventTerrain = "IIIb";
  int ventDirection = 0;

  FloorModel get currentFloor => floors[currentFloorIndex];

  void addFloor() {
    floors.add(FloorModel(label: "Niveau ${floors.length + 1}"));
  }

  void duplicateCurrentFloorTo(int targetIndex) {
    floors[targetIndex] = currentFloor.duplicate(floors[targetIndex].label);
  }
}
