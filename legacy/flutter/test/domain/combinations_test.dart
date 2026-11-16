import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  test("eluCombination is 1.35G + 1.5Q without wind", () {
    expect(eluCombination(gKn: 100, qKn: 50), closeTo(210.0, 1e-9));
  });

  test("eluCombination adds 1.5W only when wind is dominant", () {
    expect(
      eluCombination(gKn: 100, qKn: 50, wKn: 20, windDominant: true),
      closeTo(240.0, 1e-9),
    );
    expect(
      eluCombination(gKn: 100, qKn: 50, wKn: 20, windDominant: false),
      closeTo(210.0, 1e-9),
    );
  });

  test("elsCombination caractéristique is G + Q", () {
    expect(
      elsCombination(gKn: 100, qKn: 50),
      closeTo(150.0, 1e-9),
    );
  });

  test("elsCombination quasi-permanent is G + 0.3Q", () {
    expect(
      elsCombination(gKn: 100, qKn: 50, type: ElsCombinationType.quasiPermanent),
      closeTo(115.0, 1e-9),
    );
  });

  group("isWindDominant", () {
    test("true once F_vent(ELU) exceeds 15% of N_ELU", () {
      expect(isWindDominant(fVentEluKn: 20, nEluKn: 100), isTrue);
    });

    test("false below the 15% threshold", () {
      expect(isWindDominant(fVentEluKn: 10, nEluKn: 100), isFalse);
      // Comfortably below 15% of 100 — an exact "15" here would make the
      // assertion depend on whether 0.15×100 rounds to exactly 15.0 in
      // IEEE754, which isn't guaranteed and isn't the behavior under test.
      expect(isWindDominant(fVentEluKn: 14.9, nEluKn: 100), isFalse);
    });

    test("false when there is no axial load to compare against", () {
      expect(isWindDominant(fVentEluKn: 5, nEluKn: 0), isFalse);
    });
  });
}
