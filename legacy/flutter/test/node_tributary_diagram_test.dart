import "package:flutter_test/flutter_test.dart";

import "package:structcalc/src/widgets/node_tributary_diagram.dart";

void main() {
  test("quadrant sizes scale linearly with L1-L4 — no artificial per-quadrant clamp", () {
    final small = NodeTributaryGeometry(l1: 1, l2: 1, l3: 1, l4: 1, beamGapXM: 0, beamGapYM: 0);
    final big = NodeTributaryGeometry(l1: 8, l2: 8, l3: 8, l4: 8, beamGapXM: 0, beamGapYM: 0);

    // A previous version clamped each quadrant's pixel size to a fixed
    // [20, 110] range, so once a span passed that range the drawing (and
    // the mismatch against the still-correct area label) stopped
    // reflecting further edits at all.
    expect(big.gp, closeTo(small.gp * 8, 1e-6));
    expect(big.hp, closeTo(small.hp * 8, 1e-6));
    expect(big.contentSize.width, greaterThan(small.contentSize.width));
  });

  test("a bordering poutre pushes its quadrants out to the poutre's face, not its centreline", () {
    final noBeam = NodeTributaryGeometry(l1: 3, l2: 3, l3: 3, l4: 3, beamGapXM: 0, beamGapYM: 0);
    final withBeam = NodeTributaryGeometry(l1: 3, l2: 3, l3: 3, l4: 3, beamGapXM: 0.15, beamGapYM: 0.1);

    // The tributary span itself (L1's pixel length) is unaffected...
    expect(withBeam.gp, closeTo(noBeam.gp, 1e-6));
    // ...but its near edge starts further out from the poteau centre by
    // exactly the poutre's half-width, instead of touching the centreline.
    expect(withBeam.cx - withBeam.gp, closeTo(withBeam.padding + withBeam.gapX, 1e-6));
    expect(noBeam.cx - noBeam.gp, closeTo(noBeam.padding, 1e-6));
  });
}
