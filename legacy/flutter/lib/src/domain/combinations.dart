/// Load combinations shared by every flow (spec §8):
/// ELU = 1.35×G + 1.5×Q (+ 1.5×W if wind governs); ELS = G+Q (caractéristique)
/// or G + 0.3×Q (quasi-permanent).
library;

enum ElsCombinationType { caracteristique, quasiPermanent }

double eluCombination({
  required double gKn,
  required double qKn,
  double wKn = 0,
  bool windDominant = false,
}) {
  return 1.35 * gKn + 1.5 * qKn + (windDominant ? 1.5 * wKn : 0);
}

double elsCombination({
  required double gKn,
  required double qKn,
  ElsCombinationType type = ElsCombinationType.caracteristique,
}) {
  return type == ElsCombinationType.caracteristique ? gKn + qKn : gKn + 0.3 * qKn;
}

/// Wind is flagged as dominant (spec §5) once its ELU force exceeds 15% of
/// the axial ELU force on the same level.
bool isWindDominant({required double fVentEluKn, required double nEluKn}) {
  return nEluKn > 0 && fVentEluKn > 0.15 * nEluKn;
}
