import "dart:math" as math;

import "../../domain/domain.dart";
import "../common/level_form_state.dart";

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

  Map<String, dynamic> toJson() => {
        "exists": exists,
        "sectionBCm": sectionBCm,
        "sectionHCm": sectionHCm,
        if (presetName != null) "presetName": presetName,
      };

  static NodeSlot fromJson(Map<String, dynamic> json) => NodeSlot(
        exists: json["exists"] as bool,
        sectionBCm: (json["sectionBCm"] as num).toDouble(),
        sectionHCm: (json["sectionHCm"] as num).toDouble(),
        presetName: json["presetName"] as String?,
      );
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

  Map<String, dynamic> toJson() => {
        "exists": exists,
        "type": type.name,
        "sectionBCm": sectionBCm,
        "sectionHCm": sectionHCm,
        if (presetName != null) "presetName": presetName,
      };

  static EdgeSlot fromJson(Map<String, dynamic> json) => EdgeSlot(
        exists: json["exists"] as bool,
        type: EdgeType.values.byName(json["type"] as String),
        sectionBCm: (json["sectionBCm"] as num).toDouble(),
        sectionHCm: (json["sectionHCm"] as num).toDouble(),
        presetName: json["presetName"] as String?,
      );
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
    this.groupId,
  }) : coatings = [];

  bool exists;
  String romanLabel;
  String? customLabel;
  String slabTypeId;
  double slabThicknessM;
  String usageId;
  final List<CoatingSlot> coatings;

  /// Shared by every panel merged into the same group (spec follow-up:
  /// "si 2 panneaux sont collés sans une poutre au milieu, on ait la
  /// possibilité de les grouper") — null means ungrouped. Grouping is only
  /// meaningful between panels whose separating beam was deleted; see
  /// FloorModel.ungroupedNeighbors.
  String? groupId;

  String get displayLabel => customLabel ?? romanLabel;

  SlabType get slabType => slabTypes.firstWhere((s) => s.id == slabTypeId);
  UsageCategory get usage => usageCategories.firstWhere((u) => u.id == usageId);
  double get gDalleKnM2 => slabSelfWeight(slabType, thicknessM: slabThicknessM);
  double get gRevKnM2 => totalCoatingLoad(coatings.map((s) => s.coating).toList());
  double get qKnM2 => usage.qKnM2;
  double get pressureEluKnM2 => eluCombination(gKn: gDalleKnM2 + gRevKnM2, qKn: qKnM2);
  double get pressureElsKnM2 => elsCombination(gKn: gDalleKnM2 + gRevKnM2, qKn: qKnM2);

  Map<String, dynamic> toJson() => {
        "exists": exists,
        "romanLabel": romanLabel,
        if (customLabel != null) "customLabel": customLabel,
        "slabTypeId": slabTypeId,
        "slabThicknessM": slabThicknessM,
        "usageId": usageId,
        if (groupId != null) "groupId": groupId,
        "coatings": coatings.map((s) => {"name": s.coating.name, "loadKnM2": s.coating.loadKnM2}).toList(),
      };

  static BuildingPanelSlot fromJson(Map<String, dynamic> json) {
    final panel = BuildingPanelSlot(
      exists: json["exists"] as bool,
      romanLabel: json["romanLabel"] as String,
      customLabel: json["customLabel"] as String?,
      slabTypeId: json["slabTypeId"] as String,
      slabThicknessM: (json["slabThicknessM"] as num).toDouble(),
      usageId: json["usageId"] as String,
      groupId: json["groupId"] as String?,
    );
    for (final c in json["coatings"] as List) {
      final cm = c as Map<String, dynamic>;
      panel.coatings.add(CoatingSlot(Coating(name: cm["name"] as String, loadKnM2: (cm["loadKnM2"] as num).toDouble())));
    }
    return panel;
  }
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

  /// Read-only counterpart to [panelAt]: every grid cell defaults to an
  /// existing, fully-configured slab panel (matching [NodeSlot]/[EdgeSlot]'s
  /// "absent means default" convention), but a cell the user never tapped
  /// shouldn't be silently inserted into [panels] just because a painter or
  /// a results calculation happened to read it.
  BuildingPanelSlot panelOrDefault(int col, int row) =>
      panels[(col, row)] ?? BuildingPanelSlot(romanLabel: toRoman(row * nx + col + 1));

  /// Adjacent, existing panels that (col,row) could be grouped with: their
  /// shared beam was deleted, so nothing structural still separates them.
  List<(int, int)> ungroupedNeighbors(int col, int row) {
    if (!panelOrDefault(col, row).exists) return const [];
    final candidates = <(int, int)>[];
    if (col + 1 < nx) candidates.add((col + 1, row));
    if (col - 1 >= 0) candidates.add((col - 1, row));
    if (row + 1 < ny) candidates.add((col, row + 1));
    if (row - 1 >= 0) candidates.add((col, row - 1));

    final result = <(int, int)>[];
    for (final (nc, nr) in candidates) {
      if (!panelOrDefault(nc, nr).exists) continue;
      final key = nc == col
          ? (isHorizontal: true, line: math.max(row, nr), segment: col)
          : (isHorizontal: false, line: math.max(col, nc), segment: row);
      if (!(edges[key]?.exists ?? true)) result.add((nc, nr));
    }
    return result;
  }

  /// Every still-existing cell sharing (col,row)'s group — just itself if
  /// ungrouped. Deleting one member out of a group shrinks it back down
  /// automatically rather than leaving a phantom cell in the merged shape.
  List<(int, int)> groupMembers(int col, int row) {
    final id = panels[(col, row)]?.groupId;
    if (id == null) return [(col, row)];
    final result = <(int, int)>[];
    for (var c = 0; c < nx; c++) {
      for (var r = 0; r < ny; r++) {
        final slot = panels[(c, r)];
        if (slot != null && slot.groupId == id && slot.exists) result.add((c, r));
      }
    }
    return result;
  }

  /// Merges (col1,row1) and (col2,row2) into one group, absorbing whatever
  /// group either was already part of.
  void groupPanels(int col1, int row1, int col2, int row2) {
    final p1 = panelAt(col1, row1);
    final p2 = panelAt(col2, row2);
    final absorbedIds = {if (p1.groupId != null) p1.groupId!, if (p2.groupId != null) p2.groupId!};
    final id = "${col1}_${row1}_${col2}_${row2}_${DateTime.now().microsecondsSinceEpoch}";
    for (final slot in panels.values) {
      if (absorbedIds.contains(slot.groupId)) slot.groupId = id;
    }
    p1.groupId = id;
    p2.groupId = id;
  }

  /// Splits (col,row)'s whole group back into individual panels.
  void ungroupPanel(int col, int row) {
    final id = panels[(col, row)]?.groupId;
    if (id == null) return;
    for (final slot in panels.values) {
      if (slot.groupId == id) slot.groupId = null;
    }
  }

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
        groupId: v.groupId,
      );
      panel.coatings.addAll(v.coatings.map((s) => CoatingSlot(s.coating)));
      copy.panels[entry.key] = panel;
    }
    return copy;
  }

  // Map keys are records ((int,int) or BeamKey), which JSON can't encode
  // directly — flattened to "col,row" / "isHorizontal,line,segment"
  // strings and parsed back on the way in.
  Map<String, dynamic> toJson() => {
        "label": label,
        "nx": nx,
        "ny": ny,
        "spanXM": spanXM,
        "spanYM": spanYM,
        "heightM": heightM,
        "nodes": {for (final e in nodes.entries) "${e.key.$1},${e.key.$2}": e.value.toJson()},
        "edges": {for (final e in edges.entries) "${e.key.isHorizontal},${e.key.line},${e.key.segment}": e.value.toJson()},
        "panels": {for (final e in panels.entries) "${e.key.$1},${e.key.$2}": e.value.toJson()},
      };

  static FloorModel fromJson(Map<String, dynamic> json) {
    final floor = FloorModel(
      label: json["label"] as String,
      nx: json["nx"] as int,
      ny: json["ny"] as int,
      spanXM: (json["spanXM"] as List).map((e) => (e as num).toDouble()).toList(),
      spanYM: (json["spanYM"] as List).map((e) => (e as num).toDouble()).toList(),
    );
    floor.heightM = (json["heightM"] as num).toDouble();

    for (final entry in (json["nodes"] as Map<String, dynamic>).entries) {
      final parts = entry.key.split(",");
      floor.nodes[(int.parse(parts[0]), int.parse(parts[1]))] = NodeSlot.fromJson(entry.value as Map<String, dynamic>);
    }
    for (final entry in (json["edges"] as Map<String, dynamic>).entries) {
      final parts = entry.key.split(",");
      final key = (isHorizontal: parts[0] == "true", line: int.parse(parts[1]), segment: int.parse(parts[2]));
      floor.edges[key] = EdgeSlot.fromJson(entry.value as Map<String, dynamic>);
    }
    for (final entry in (json["panels"] as Map<String, dynamic>).entries) {
      final parts = entry.key.split(",");
      floor.panels[(int.parse(parts[0]), int.parse(parts[1]))] = BuildingPanelSlot.fromJson(entry.value as Map<String, dynamic>);
    }
    return floor;
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

/// Top-level state for the bâtiment complet flow: every floor and the
/// building-wide wind parameters (spec §7: "Sous-étape Vent : mêmes
/// paramètres EC1 que le Voile isolé"). Dimension-type presets live at
/// app level instead (see AppState.presets in state/app_state.dart) —
/// they're shared across every bâtiment complet visit, not scoped to one.
class BuildingState {
  BuildingState() : floors = [FloorModel(label: "RDC")];

  final List<FloorModel> floors;
  int currentFloorIndex = 0;

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

  Map<String, dynamic> toJson() => {
        "floors": floors.map((f) => f.toJson()).toList(),
        "currentFloorIndex": currentFloorIndex,
        "ventZone": ventZone,
        "ventRegion": ventRegion,
        "ventTerrain": ventTerrain,
        "ventDirection": ventDirection,
      };

  /// Restores a full modelling session — every floor, grid, node/edge/
  /// panel slot and the vent parameters — from a project previously saved
  /// via [toJson].
  static BuildingState fromJson(Map<String, dynamic> json) {
    final state = BuildingState();
    state.floors
      ..clear()
      ..addAll((json["floors"] as List).map((f) => FloorModel.fromJson(f as Map<String, dynamic>)));
    state.currentFloorIndex = json["currentFloorIndex"] as int;
    state.ventZone = json["ventZone"] as String;
    state.ventRegion = json["ventRegion"] as String;
    state.ventTerrain = json["ventTerrain"] as String;
    state.ventDirection = json["ventDirection"] as int;
    return state;
  }
}
