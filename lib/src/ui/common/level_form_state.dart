import "../../domain/domain.dart";

/// A coating list entry with a stable identity independent of its position
/// in the list. Without this, removing a coating from the middle of the
/// list makes Flutter reuse the wrong `_CoatingRow` State (and its
/// `TextEditingController`) for the item that shifted into that slot,
/// showing stale text — keying widgets by [id] instead of list index
/// avoids that.
class CoatingSlot {
  CoatingSlot(this.coating) : id = _nextId++;

  static int _nextId = 0;

  final int id;
  Coating coating;
}

/// Mutable per-level input shared by the poteau and voile isolé flows
/// (spec §4-5 step "Niveaux"): storey height, slab type/thickness, EC1
/// usage category, and an unlimited coatings list. Deliberately not an
/// immutable model — the level-editor UI mutates fields in place and
/// calls `setState` on its owning flow screen.
class LevelFormState {
  LevelFormState({
    required this.label,
    this.heightM = 3.0,
    this.slabTypeId = "cc16",
    this.slabThicknessM = 0.16,
    this.usageId = "A",
  })  : coatings = [],
        id = _nextId++;

  static int _nextId = 0;

  /// Stable identity for keying its `LevelEditorCard` — see [CoatingSlot]
  /// for why list position alone isn't safe to key widgets by.
  final int id;

  String label;
  double heightM;
  String slabTypeId;

  /// Only meaningful when [slabTypeId] is the "dp" (dalle pleine) entry.
  double slabThicknessM;
  String usageId;
  final List<CoatingSlot> coatings;

  /// Free-form numeric bag for whatever a specific flow needs per level
  /// beyond the fields above — e.g. poteau's b×h section or voile's
  /// épaisseur — without forcing every flow to carry every other flow's
  /// fields.
  final Map<String, double> extra = {};

  double extraOr(String key, double fallback) => extra[key] ?? fallback;

  SlabType get slabType => slabTypes.firstWhere((s) => s.id == slabTypeId);
  UsageCategory get usage => usageCategories.firstWhere((u) => u.id == usageId);

  double get gDalleKnM2 => slabSelfWeight(slabType, thicknessM: slabThicknessM);
  double get gRevKnM2 => totalCoatingLoad(coatings.map((s) => s.coating).toList());
  double get qKnM2 => usage.qKnM2;

  LevelInput toLevelInput() => LevelInput(
        label: label,
        heightM: heightM,
        gDalleKnM2: gDalleKnM2,
        gRevKnM2: gRevKnM2,
        qKnM2: qKnM2,
      );
}
