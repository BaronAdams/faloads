/// Shared reference data reused across every calculation flow (spec §8).
/// A single source of truth — the HTML prototypes duplicated these
/// catalogues per screen; the Flutter port must not repeat that mistake.
library;

/// Design code a calculation is run under. Coefficients in [predim.dart]
/// differ slightly between the two (see `predimCoeff`).
enum Reglement { ec2, bael91 }

extension ReglementLabel on Reglement {
  String get label => switch (this) {
        Reglement.ec2 => "Eurocode 2",
        Reglement.bael91 => "BAEL 91",
      };
}

class BetonClass {
  const BetonClass(this.id, this.fckMpa);

  /// e.g. "C25/30"
  final String id;

  /// Characteristic compressive strength, MPa.
  final int fckMpa;
}

const List<BetonClass> betonClasses = [
  BetonClass("C20/25", 20),
  BetonClass("C25/30", 25),
  BetonClass("C30/37", 30),
  BetonClass("C35/45", 35),
];

/// Looks up [fckMpa] for a beton id (e.g. "C25/30" → 25); falls back to
/// C25/30 for an unrecognised id, mirroring the prototype's regex parse.
int fckOf(String betonId) {
  final match = betonClasses.where((b) => b.id == betonId);
  return match.isEmpty ? 25 : match.first.fckMpa;
}

class SlabType {
  const SlabType(this.id, this.label, this.selfWeightKnM2);

  final String id;
  final String label;

  /// Self-weight in kN/m². Null for "Dalle pleine" (DP), whose weight
  /// depends on a user-entered thickness — see [slabSelfWeight].
  final double? selfWeightKnM2;

  bool get isDallePleine => selfWeightKnM2 == null;
}

const List<SlabType> slabTypes = [
  SlabType("cc12", "CC 12+4", 2.80),
  SlabType("cc16", "CC 16+4", 3.54),
  SlabType("cc20", "CC 20+5", 4.40),
  SlabType("dp", "DP — Dalle pleine", null),
];

/// Concrete unit weight (kN/m³) used to derive a dalle pleine's self-weight
/// from its user-chosen thickness.
const double concreteUnitWeightKnM3 = 25.0;

/// Self-weight (kN/m²) of a slab panel. [thicknessM] is required (and used)
/// only for [SlabType.isDallePleine].
double slabSelfWeight(SlabType type, {double? thicknessM}) {
  if (!type.isDallePleine) return type.selfWeightKnM2!;
  assert(thicknessM != null, "Dalle pleine requires a thickness");
  return (thicknessM ?? 0) * concreteUnitWeightKnM3;
}

class UsageCategory {
  const UsageCategory(this.id, this.label, this.qKnM2);

  /// EC1 category id, e.g. "A".
  final String id;
  final String label;

  /// Default exploitation load, kN/m² — user-overridable per the spec.
  final double qKnM2;
}

const List<UsageCategory> usageCategories = [
  UsageCategory("A", "Habitation", 1.5),
  UsageCategory("B", "Bureaux", 2.5),
  UsageCategory("C", "Lieux publics", 4.0),
  UsageCategory("D", "Commerce", 5.0),
  UsageCategory("E", "Stockage", 6.0),
  UsageCategory("H", "Toiture inaccessible", 1.0),
];

/// One free-form floor coating/finish entry (name + surface load).
class Coating {
  const Coating({required this.name, required this.loadKnM2});

  final String name;
  final double loadKnM2;
}

/// Sums an unlimited, user-defined coating list into G_rev (kN/m²).
double totalCoatingLoad(List<Coating> coatings) =>
    coatings.fold(0.0, (sum, c) => sum + c.loadKnM2);
