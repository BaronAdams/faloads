/// Bâtiment complet (spec §7): node (poteau) tributary geometry for a grid
/// of independent travée spans. Beam/wall (poutre/voile) edge loads and
/// slab-panel tributary splits reuse [computeBeamGridLoads] directly from
/// beam_grid.dart — the topology (an nx×ny grid of cells bordered by
/// horizontal/vertical edges) is identical to the réseau de poutres flow,
/// so there's no need for a second implementation of that math.
library;

/// Half the span on each side of node [index] along one axis, summed —
/// e.g. for spans [4, 5, 3] (3 travées, 4 nodes at indices 0-3): node 1
/// gets half of span 0 (index-1) plus half of span 1 (index), i.e. the
/// same "L1 = gauche, L2 = droite" concept from the poteau isolé flow,
/// just derived automatically from the grid instead of typed in by hand.
double nodeTributaryWidthM(List<double> spans, int index) {
  var width = 0.0;
  if (index > 0) width += spans[index - 1] / 2;
  if (index < spans.length) width += spans[index] / 2;
  return width;
}

/// A node's full tributary area — the product of its tributary width in
/// each direction. [colIndex] indexes [spanXM] (0..nx), [rowIndex] indexes
/// [spanYM] (0..ny).
double nodeTributaryAreaM2({
  required List<double> spanXM,
  required List<double> spanYM,
  required int colIndex,
  required int rowIndex,
}) {
  return nodeTributaryWidthM(spanXM, colIndex) * nodeTributaryWidthM(spanYM, rowIndex);
}
