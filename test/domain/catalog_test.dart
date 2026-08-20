import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  test("fckOf reads the known beton classes", () {
    expect(fckOf("C20/25"), 20);
    expect(fckOf("C35/45"), 35);
  });

  test("fckOf falls back to C25/30 for an unknown id", () {
    expect(fckOf("C99/99"), 25);
  });

  test("slabSelfWeight reads the catalogue value for non-DP slabs", () {
    final cc20 = slabTypes.firstWhere((s) => s.id == "cc20");
    expect(slabSelfWeight(cc20), closeTo(4.40, 1e-9));
  });

  test("slabSelfWeight derives dalle pleine weight from thickness", () {
    final dp = slabTypes.firstWhere((s) => s.isDallePleine);
    expect(slabSelfWeight(dp, thicknessM: 0.16), closeTo(4.0, 1e-9)); // 0.16*25
  });

  test("totalCoatingLoad sums an arbitrary coating list", () {
    const coatings = [
      Coating(name: "Carrelage", loadKnM2: 0.5),
      Coating(name: "Faux plafond", loadKnM2: 0.2),
    ];
    expect(totalCoatingLoad(coatings), closeTo(0.7, 1e-9));
  });

  test("totalCoatingLoad of an empty list is zero", () {
    expect(totalCoatingLoad(const []), 0.0);
  });
}
