import "../../domain/domain.dart";
import "../common/level_form_state.dart";

/// Mutable per-cell slab-panel input for the réseau de poutres flow
/// (spec §6 step "Modélisation des dalles") — same catalogues as the
/// poteau/voile levels (dalle type, usage, coatings), combined into the
/// ELU/ELS pressures [computeBeamGridLoads] needs.
class PanelSlot {
  PanelSlot({
    this.mode = PanelMode.vide,
    this.slabTypeId = "cc16",
    this.slabThicknessM = 0.16,
    this.usageId = "A",
  }) : coatings = [];

  PanelMode mode;
  String slabTypeId;
  double slabThicknessM;
  String usageId;
  final List<CoatingSlot> coatings;

  SlabType get slabType => slabTypes.firstWhere((s) => s.id == slabTypeId);
  UsageCategory get usage => usageCategories.firstWhere((u) => u.id == usageId);

  double get gDalleKnM2 => slabSelfWeight(slabType, thicknessM: slabThicknessM);
  double get gRevKnM2 => totalCoatingLoad(coatings.map((s) => s.coating).toList());
  double get qKnM2 => usage.qKnM2;

  double get pressureEluKnM2 => eluCombination(gKn: gDalleKnM2 + gRevKnM2, qKn: qKnM2);
  double get pressureElsKnM2 => elsCombination(gKn: gDalleKnM2 + gRevKnM2, qKn: qKnM2);

  BeamPanelInput toInput() => BeamPanelInput(
        mode: mode,
        pressureEluKnM2: pressureEluKnM2,
        pressureElsKnM2: pressureElsKnM2,
      );
}

/// Mutable per-segment beam input (spec §6 step "Grille": "l'utilisateur
/// doit pouvoir saisir une section par tronçon, pas une valeur unique
/// globale") — also carries the active/removed toggle for a sparse network.
class BeamSlot {
  BeamSlot({this.active = true, this.sectionBCm = 25, this.sectionHCm = 40});

  bool active;
  double sectionBCm;
  double sectionHCm;
}

/// Every beam key geometrically possible for an nx×ny grid: horizontal
/// beams run along a row (ny+1 rows, nx segments each); vertical beams run
/// along a column (nx+1 columns, ny segments each).
List<BeamKey> allBeamKeysFor({required int nx, required int ny}) {
  final keys = <BeamKey>[];
  for (var line = 0; line <= ny; line++) {
    for (var segment = 0; segment < nx; segment++) {
      keys.add((isHorizontal: true, line: line, segment: segment));
    }
  }
  for (var line = 0; line <= nx; line++) {
    for (var segment = 0; segment < ny; segment++) {
      keys.add((isHorizontal: false, line: line, segment: segment));
    }
  }
  return keys;
}

String beamKeyLabel(BeamKey key) {
  final orientation = key.isHorizontal ? "H" : "V";
  return "Poutre $orientation${key.line + 1}.${key.segment + 1}";
}
