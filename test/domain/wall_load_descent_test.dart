import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  test("cumulateWallLoadDescent accumulates G/Q/wind top-to-bottom", () {
    final results = cumulateWallLoadDescent(
      levelsTopToBottom: const [
        LevelInput(label: "R+1", heightM: 3, gDalleKnM2: 2.0, gRevKnM2: 0.5, qKnM2: 1.5),
        LevelInput(label: "RDC", heightM: 3, gDalleKnM2: 2.0, gRevKnM2: 0.5, qKnM2: 1.5),
      ],
      tributaryAreaM2: 4,
      wallLengthM: 5,
    );

    expect(results, hasLength(2));

    final rPlus1 = results[0];
    expect(rPlus1.base.nEluKn, closeTo(22.5, 1e-9));
    expect(rPlus1.fVentEluKn, closeTo(15.615, 1e-9));
    expect(rPlus1.windDominant, isTrue); // 15.615 > 15% of 22.5 (3.375)

    final rdc = results[1];
    expect(rdc.base.nEluKn, closeTo(45.0, 1e-9));
    expect(rdc.fVentEluKn, closeTo(29.07, 1e-9));
    expect(rdc.windDominant, isTrue);
    // RDC is lower (smaller elevation) but still accumulates more wind
    // force overall, since it sums everything above it too.
    expect(rdc.fVentEluKn, greaterThan(rPlus1.fVentEluKn));
  });

  test("wind is not flagged dominant when the force is negligible", () {
    final results = cumulateWallLoadDescent(
      levelsTopToBottom: const [
        LevelInput(label: "RDC", heightM: 3, gDalleKnM2: 50, gRevKnM2: 10, qKnM2: 20),
      ],
      tributaryAreaM2: 20,
      wallLengthM: 0.01, // negligible wall length -> negligible wind force
    );

    expect(results.single.windDominant, isFalse);
  });
}
