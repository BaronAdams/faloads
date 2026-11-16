import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  group("windPressureKnM2", () {
    test("increases linearly with elevation above the 0.45 kN/m² floor", () {
      expect(windPressureKnM2(0), closeTo(0.55, 1e-9));
      expect(windPressureKnM2(10), closeTo(0.87, 1e-9));
    });

    test("never drops below the 0.45 kN/m² floor", () {
      expect(windPressureKnM2(-100), 0.45);
    });
  });

  test("windForceKnPerLevel multiplies pressure by wall length and height", () {
    expect(
      windForceKnPerLevel(elevationM: 10, wallLengthM: 5, levelHeightM: 3),
      closeTo(13.05, 1e-9), // 0.87 × 5 × 3
    );
  });
}
