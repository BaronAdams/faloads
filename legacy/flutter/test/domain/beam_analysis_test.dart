import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  group("analyzeSimplySupportedBeamUdl", () {
    test("reactions/moment/shear match closed-form statics", () {
      final r = analyzeSimplySupportedBeamUdl(
        spanM: 4,
        gKnM: 3,
        qKnM: 2,
        sectionBCm: 20,
        sectionHCm: 40,
        fckMpa: 25,
      );
      // w_ELU = 1.35×3 + 1.5×2 = 7.05 kN/m
      expect(r.wEluKnM, closeTo(7.05, 1e-9));
      expect(r.wElsKnM, closeTo(5.0, 1e-9));
      // R = V = w×L/2 = 14.1 kN, M = w×L²/8 = 14.1 kN·m
      expect(r.reactionKn, closeTo(14.1, 1e-9));
      expect(r.shearMaxKn, closeTo(14.1, 1e-9));
      expect(r.momentMaxKnM, closeTo(14.1, 1e-9));
      // Elastic deflection is small for this generously-sized section —
      // sanity-bounded rather than pinned to an exact value.
      expect(r.deflectionMm, greaterThan(0));
      expect(r.deflectionMm, lessThan(r.deflectionLimitMm));
      expect(r.deflectionLimitMm, closeTo(4000 / 250, 1e-9));
      expect(r.deflectionOk, isTrue);
    });

    test("a too-slender section fails the deflection check", () {
      final r = analyzeSimplySupportedBeamUdl(
        spanM: 8,
        gKnM: 10,
        qKnM: 8,
        sectionBCm: 15,
        sectionHCm: 20,
        fckMpa: 20,
      );
      expect(r.deflectionOk, isFalse);
    });
  });

  group("analyzePortalFrameUdl", () {
    test("symmetric frame moments match the slope-deflection closed form", () {
      final r = analyzePortalFrameUdl(
        spanM: 6,
        heightM: 3,
        gKnM: 8,
        qKnM: 4,
        beamBCm: 25,
        beamHCm: 45,
        columnBCm: 30,
        columnHCm: 30,
      );
      // w_ELU = 1.35×8 + 1.5×4 = 16.8 kN/m
      expect(r.wEluKnM, closeTo(16.8, 1e-9));
      // k = (I_beam/L)/(I_column/h) ≈ 1.406
      expect(r.stiffnessRatioK, closeTo(1.406, 0.01));
      // M_B = w×L²/(12+6k) ≈ 29.6 kN·m
      expect(r.jointMomentKnM, closeTo(29.6, 0.1));
      // M_base = M_B/2
      expect(r.baseMomentKnM, closeTo(r.jointMomentKnM / 2, 1e-9));
      // M_midspan = w×L²/8 − M_B
      expect(r.beamMidspanMomentKnM, closeTo(16.8 * 36 / 8 - r.jointMomentKnM, 1e-9));
      // Column shear = (M_base + M_B) / h
      expect(r.columnShearKn, closeTo((r.baseMomentKnM + r.jointMomentKnM) / 3, 1e-9));
    });

    test("a much stiffer column (k→0) pushes the joint moment toward w×L²/12 (fixed-end value)", () {
      // Columns far stiffer than the beam behave like a full fixity at the
      // beam ends — the classic fixed-fixed beam result, w×L²/12.
      final r = analyzePortalFrameUdl(
        spanM: 5,
        heightM: 3,
        gKnM: 10,
        qKnM: 5,
        beamBCm: 10,
        beamHCm: 10,
        columnBCm: 200,
        columnHCm: 200,
      );
      const wElu = 1.35 * 10 + 1.5 * 5;
      expect(r.jointMomentKnM, closeTo(wElu * 5 * 5 / 12, wElu * 5 * 5 / 12 * 0.05));
    });
  });
}
