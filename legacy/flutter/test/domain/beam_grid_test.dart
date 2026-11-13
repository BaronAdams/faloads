import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  group("computeBeamGridLoads — single panel, mode complet", () {
    // 4m (X, short) × 6m (Y, long) panel, ELU pressure 10 kN/m², ELS 6 kN/m².
    final results = computeBeamGridLoads(
      spanXM: [4],
      spanYM: [6],
      panels: const {
        (0, 0): BeamPanelInput(mode: PanelMode.complet, pressureEluKnM2: 10, pressureElsKnM2: 6),
      },
    );

    test("all 4 bordering beams receive load", () {
      expect(results.keys, hasLength(4));
    });

    test("horizontal edges (length = short span, 4m) get the triangle share", () {
      final top = results[(isHorizontal: true, line: 0, segment: 0)]!;
      final bottom = results[(isHorizontal: true, line: 1, segment: 0)]!;
      expect(top.lengthM, 4);
      expect(top.qEluKnM, closeTo(10.0, 1e-9));
      expect(top.qElsKnM, closeTo(6.0, 1e-9));
      expect(bottom.qEluKnM, closeTo(top.qEluKnM, 1e-9));
    });

    test("vertical edges (length = long span, 6m) get the trapezoid share", () {
      final left = results[(isHorizontal: false, line: 0, segment: 0)]!;
      final right = results[(isHorizontal: false, line: 1, segment: 0)]!;
      expect(left.lengthM, 6);
      expect(left.qEluKnM, closeTo(40 / 3, 1e-9));
      expect(left.qElsKnM, closeTo(8.0, 1e-9));
      expect(right.qEluKnM, closeTo(left.qEluKnM, 1e-9));
    });

    test("mMax/tMax use the isostatic single-span UDL formulas", () {
      final top = results[(isHorizontal: true, line: 0, segment: 0)]!;
      expect(top.mMaxKnM, closeTo(20.0, 1e-9)); // 10×4²/8
      expect(top.tMaxKn, closeTo(20.0, 1e-9)); // 10×4/2

      final left = results[(isHorizontal: false, line: 0, segment: 0)]!;
      expect(left.mMaxKnM, closeTo(60.0, 1e-6)); // (40/3)×6²/8
    });

    test("total tributary area across all 4 edges equals the panel's own area", () {
      final r = results.values;
      // area_i = q_i × length_i / pressure — recovers each edge's tributary area.
      final totalArea = r.fold<double>(0, (sum, b) => sum + (b.qEluKnM * b.lengthM) / 10);
      expect(totalArea, closeTo(4 * 6, 1e-6));
    });

    test("momentAtKnM peaks at mid-span, matching mMaxKnM", () {
      final top = results[(isHorizontal: true, line: 0, segment: 0)]!;
      expect(top.momentAtKnM(2.0), closeTo(top.mMaxKnM, 1e-9));
      expect(top.momentAtKnM(0), closeTo(0, 1e-9));
      expect(top.momentAtKnM(4), closeTo(0, 1e-9));
    });

    test("each beam records exactly the one contributing panel", () {
      final top = results[(isHorizontal: true, line: 0, segment: 0)]!;
      expect(top.contributions, hasLength(1));
      expect(top.contributions.single.panelCol, 0);
      expect(top.contributions.single.panelRow, 0);
    });
  });

  test("mode demiNe only loads the top and right edges, at half the full share", () {
    final complet = computeBeamGridLoads(
      spanXM: [4],
      spanYM: [6],
      panels: const {(0, 0): BeamPanelInput(mode: PanelMode.complet, pressureEluKnM2: 10, pressureElsKnM2: 6)},
    );
    final demiNe = computeBeamGridLoads(
      spanXM: [4],
      spanYM: [6],
      panels: const {(0, 0): BeamPanelInput(mode: PanelMode.demiNe, pressureEluKnM2: 10, pressureElsKnM2: 6)},
    );

    expect(demiNe.keys, hasLength(2));
    expect(demiNe[(isHorizontal: true, line: 1, segment: 0)], isNull); // bottom absent
    expect(demiNe[(isHorizontal: false, line: 0, segment: 0)], isNull); // left absent

    final topFull = complet[(isHorizontal: true, line: 0, segment: 0)]!;
    final topHalf = demiNe[(isHorizontal: true, line: 0, segment: 0)]!;
    expect(topHalf.qEluKnM, closeTo(topFull.qEluKnM / 2, 1e-9));
  });

  test("mode demiSo only loads the bottom and left edges", () {
    final demiSo = computeBeamGridLoads(
      spanXM: [4],
      spanYM: [6],
      panels: const {(0, 0): BeamPanelInput(mode: PanelMode.demiSo, pressureEluKnM2: 10, pressureElsKnM2: 6)},
    );

    expect(demiSo.keys, hasLength(2));
    expect(demiSo.containsKey((isHorizontal: true, line: 1, segment: 0)), isTrue); // bottom present
    expect(demiSo.containsKey((isHorizontal: false, line: 0, segment: 0)), isTrue); // left present
  });

  test("mode vide contributes nothing", () {
    final results = computeBeamGridLoads(
      spanXM: [4],
      spanYM: [6],
      panels: const {(0, 0): BeamPanelInput(mode: PanelMode.vide, pressureEluKnM2: 10, pressureElsKnM2: 6)},
    );
    expect(results, isEmpty);
  });

  test("a panel with no entry in the map is treated as vide", () {
    final results = computeBeamGridLoads(spanXM: [4], spanYM: [6], panels: const {});
    expect(results, isEmpty);
  });

  test("the short/long edge roles flip when Y is the short span", () {
    final results = computeBeamGridLoads(
      spanXM: [8],
      spanYM: [3],
      panels: const {(0, 0): BeamPanelInput(mode: PanelMode.complet, pressureEluKnM2: 10, pressureElsKnM2: 0)},
    );
    // Now the vertical edges (length = 3, the short span) get the triangle share.
    final left = results[(isHorizontal: false, line: 0, segment: 0)]!;
    final top = results[(isHorizontal: true, line: 0, segment: 0)]!;
    expect(left.qEluKnM, closeTo(7.5, 1e-9));
    expect(top.qEluKnM, closeTo(12.1875, 1e-9));
  });
}
