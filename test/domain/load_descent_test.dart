import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  test("cumulateLoadDescent accumulates top-to-bottom", () {
    final results = cumulateLoadDescent(
      levelsTopToBottom: const [
        LevelInput(label: "R+1", heightM: 3, gDalleKnM2: 3.0, gRevKnM2: 1.0, qKnM2: 1.5),
        LevelInput(label: "RDC", heightM: 3, gDalleKnM2: 3.5, gRevKnM2: 1.2, qKnM2: 2.5),
      ],
      tributaryAreaM2: 10,
    );

    expect(results, hasLength(2));

    final rPlus1 = results[0];
    expect(rPlus1.gTotKnM2, closeTo(4.0, 1e-9));
    expect(rPlus1.nEluKn, closeTo(76.5, 1e-9));
    expect(rPlus1.nElsKn, closeTo(55.0, 1e-9));

    final rdc = results[1];
    expect(rdc.gTotKnM2, closeTo(4.7, 1e-9));
    // RDC must carry its own level PLUS everything summed above it.
    expect(rdc.nEluKn, closeTo(177.45, 1e-6));
    expect(rdc.nElsKn, closeTo(127.0, 1e-9));
    expect(rdc.nEluKn, greaterThan(rPlus1.nEluKn));
  });

  test("an empty level list produces no results", () {
    expect(
      cumulateLoadDescent(levelsTopToBottom: const [], tributaryAreaM2: 10),
      isEmpty,
    );
  });

  group("classifyColumnPosition", () {
    test("no zero span is an interior column", () {
      expect(
        classifyColumnPosition(l1: 3, l2: 3, l3: 3, l4: 3),
        ColumnPosition.interieur,
      );
    });

    test("exactly one zero span is an edge (de rive) column", () {
      expect(
        classifyColumnPosition(l1: 0, l2: 3, l3: 3, l4: 3),
        ColumnPosition.rive,
      );
    });

    test("two or more zero spans is a corner (d'angle) column", () {
      expect(
        classifyColumnPosition(l1: 0, l2: 0, l3: 3, l4: 3),
        ColumnPosition.angle,
      );
    });
  });
}
