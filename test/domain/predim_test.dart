import "package:flutter_test/flutter_test.dart";
import "package:structcalc/src/domain/domain.dart";

void main() {
  group("predimPoteau", () {
    test("EC2, C30/37 — clean coefficient (1.6)", () {
      final r = predimPoteau(nEluKn: 800, beton: "C30/37", reglement: Reglement.ec2);
      expect(r.fckMpa, 30);
      expect(r.aminCm2, closeTo(500.0, 1e-9));
      expect(r.sideCm, 25.0); // sqrt(500)=22.36 -> rounds up to 25
    });

    test("clamps to the 20 cm minimum side", () {
      final r = predimPoteau(nEluKn: 160, beton: "C30/37", reglement: Reglement.ec2);
      expect(r.aminCm2, closeTo(100.0, 1e-9));
      expect(r.sideCm, 20.0); // sqrt(100)=10 -> would round to 10, clamped to 20
    });

    test("BAEL uses a different coefficient than EC2", () {
      final r = predimPoteau(nEluKn: 1445, beton: "C30/37", reglement: Reglement.bael91);
      expect(r.aminCm2, closeTo(1000.0, 1e-6));
      expect(r.sideCm, 35.0); // sqrt(1000)=31.6 -> rounds up to 35
    });
  });

  group("predimVoile", () {
    test("clamps to the 15 cm minimum thickness", () {
      final r = predimVoile(
        nEluKn: 800,
        beton: "C30/37",
        reglement: Reglement.ec2,
        longueurM: 2.5,
      );
      expect(r.aminCm2, closeTo(500.0, 1e-9));
      expect(r.eMinCm, 15.0);
    });

    test("above the minimum, thickness follows Amin / length", () {
      final r = predimVoile(
        nEluKn: 1600,
        beton: "C30/37",
        reglement: Reglement.ec2,
        longueurM: 0.5,
      );
      expect(r.aminCm2, closeTo(1000.0, 1e-9));
      expect(r.eMinCm, 20.0);
    });

    test("defaults to a 1 m run for the load-descent flow", () {
      final perMetre = predimVoile(nEluKn: 800, beton: "C30/37", reglement: Reglement.ec2);
      final explicit1m = predimVoile(
        nEluKn: 800,
        beton: "C30/37",
        reglement: Reglement.ec2,
        longueurM: 1.0,
      );
      expect(perMetre.eMinCm, explicit1m.eMinCm);
    });
  });

  group("predimPoutre", () {
    test("isostatique", () {
      final r = predimPoutre(lM: 6, qEluKnM: 10, appui: AppuiType.isostatique);
      expect(r.hCm, 50.0);
      expect(r.bCm, 25.0);
      expect(r.mMaxKnM, closeTo(45.0, 1e-9));
    });

    test("continue_ clamps b to its 15 cm minimum", () {
      final r = predimPoutre(lM: 4, qEluKnM: 6, appui: AppuiType.continue_);
      expect(r.hCm, 25.0);
      expect(r.bCm, 15.0); // h/2=12.5 -> would round to 15 anyway
      expect(r.mMaxKnM, closeTo(8.0, 1e-9));
    });

    test("console uses its own h and moment coefficients", () {
      final r = predimPoutre(lM: 1.2, qEluKnM: 5, appui: AppuiType.console);
      expect(r.hCm, 20.0);
      expect(r.bCm, 15.0);
      expect(r.mMaxKnM, closeTo(3.6, 1e-9));
    });
  });

  test("predimEscalier respects the loi de Blondel window", () {
    final r = predimEscalier(hauteurM: 3.0, longueurProjeteeM: 4.25);
    expect(r.nMarches, 18);
    expect(r.gironCm, closeTo(25.0, 1e-9));
    expect(r.blondelCm, closeTo(58.33, 0.01));
    expect(r.blondelOk, isTrue);
    expect(r.epaisseurCm, 22.0);
  });

  group("predimBalcon", () {
    test("above the minimum", () {
      final r = predimBalcon(porteeM: 3.0, gKnM2: 4, qKnM2: 2);
      expect(r.epaisseurCm, 30.0);
      expect(r.muKnM, closeTo(37.8, 1e-9));
    });

    test("clamps to the 12 cm minimum", () {
      final r = predimBalcon(porteeM: 1.0, gKnM2: 2, qKnM2: 1);
      expect(r.epaisseurCm, 12.0);
      expect(r.muKnM, closeTo(2.1, 1e-9));
    });
  });

  group("predimPlancher", () {
    test("dalle pleine follows L/25", () {
      final r = predimPlancher(porteeM: 5.0, pleine: true);
      expect(r.epaisseurCm, 20.0);
      expect(r.label, "Dalle pleine 20 cm");
    });

    test("corps creux abacus picks the bracket matching the span", () {
      expect(predimPlancher(porteeM: 4.0, pleine: false).label, "Corps creux 16+4");
      expect(predimPlancher(porteeM: 5.0, pleine: false).label, "Corps creux 20+4");
      expect(predimPlancher(porteeM: 6.5, pleine: false).label, "Corps creux 25+4");
    });
  });
}
