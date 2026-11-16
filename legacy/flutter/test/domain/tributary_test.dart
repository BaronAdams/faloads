import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  test("rectangularPanelTributary splits a panel via the first bisector", () {
    final t = rectangularPanelTributary(shortSpanM: 4, longSpanM: 6, pressureKnM2: 10);

    expect(t.shortEdgeAreaM2, closeTo(4.0, 1e-9)); // Wx²/4 = 16/4
    expect(t.longEdgeAreaM2, closeTo(8.0, 1e-9)); // (Wx/2)×(Wy−Wx/2) = 2×4
    expect(t.shortEdgeLinearLoadKnM, closeTo(10.0, 1e-9)); // 4×10 / 4
    expect(t.longEdgeLinearLoadKnM, closeTo(13.3333, 1e-3)); // 8×10 / 6
  });

  test("a square panel splits its area evenly into 4 triangles", () {
    final t = rectangularPanelTributary(shortSpanM: 5, longSpanM: 5, pressureKnM2: 8);
    expect(t.shortEdgeAreaM2, closeTo(t.longEdgeAreaM2, 1e-9));
    expect(t.shortEdgeAreaM2, closeTo(6.25, 1e-9)); // 25/4
  });

  test("aggregateBeamLinearLoad sums contributions from adjacent panels", () {
    final total = aggregateBeamLinearLoad([10.0, 13.3333, 4.5]);
    expect(total, closeTo(27.8333, 1e-3));
  });

  test("aggregateBeamLinearLoad of no panels is zero", () {
    expect(aggregateBeamLinearLoad(const []), 0.0);
  });
}
