import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  group("nodeTributaryWidthM", () {
    const spans = [4.0, 5.0, 3.0]; // 3 travées -> 4 node indices (0-3)

    test("an end node only gets half of its one adjacent span", () {
      expect(nodeTributaryWidthM(spans, 0), closeTo(2.0, 1e-9)); // half of 4
      expect(nodeTributaryWidthM(spans, 3), closeTo(1.5, 1e-9)); // half of 3
    });

    test("an interior node gets half of each adjacent span", () {
      expect(nodeTributaryWidthM(spans, 1), closeTo(4.5, 1e-9)); // 4/2 + 5/2
      expect(nodeTributaryWidthM(spans, 2), closeTo(4.0, 1e-9)); // 5/2 + 3/2
    });
  });

  test("nodeTributaryAreaM2 multiplies the X and Y tributary widths", () {
    final area = nodeTributaryAreaM2(
      spanXM: const [4.0, 5.0, 3.0],
      spanYM: const [6.0, 6.0],
      colIndex: 1,
      rowIndex: 1,
    );
    // X: 4/2+5/2=4.5, Y: 6/2+6/2=6.0 -> 27.0
    expect(area, closeTo(27.0, 1e-9));
  });

  test("a single-span axis reduces to half the span at either end", () {
    expect(nodeTributaryWidthM(const [4.0], 0), closeTo(2.0, 1e-9));
    expect(nodeTributaryWidthM(const [4.0], 1), closeTo(2.0, 1e-9));
  });
}
