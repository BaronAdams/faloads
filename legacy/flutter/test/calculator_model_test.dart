import 'package:flutter_test/flutter_test.dart';
import 'package:structcalc/src/ui/calculators/workspace/calculator_model.dart';

void main() {
  test('all proposed UI templates have coherent ranges and connections', () {
    for (final preset in ['reference', 'blank', 'cantilever', 'continuous']) {
      final model = CalculatorModel.preset(CalculatorKind.beam, preset);
      expect(model.validationError, isNull, reason: preset);
    }
    final frame = CalculatorModel.preset(CalculatorKind.frame, 'multistorey');
    expect(frame.nodes.length, 9);
    expect(frame.members.length, 10);
    expect(frame.validationError, isNull);
    expect(frame.isReference, isFalse);
  });
  for (final kind in CalculatorKind.values) {
    test('${kind.name}: reference, copy and persisted state round trip', () {
      final model = CalculatorModel.reference(kind);
      expect(model.validationError, isNull);
      expect(model.copy().isReference, isTrue);
      expect(CalculatorModel.fromJson(model.toJson()).toJson(), model.toJson());
      model.young = 35;
      expect(model.isReference, isFalse, reason: 'A modified UI model cannot reuse reference results.');
      expect(CalculatorModel.reference(kind).young, 30);
    });
  }
  test('beam resizing preserves the relative locations and contiguous sections', () {
    final model = CalculatorModel.reference(CalculatorKind.beam);
    model.resizeBeam(4);
    expect(model.validationError, isNull);
    expect(model.supports.last.number('x'), 4);
    expect(model.loads.first.number('end'), 2);
    expect(model.loads.last.number('x'), 2.5);
    expect(model.sections.last.number('end'), 4);
  });
  test('deleting a node removes dependent bars without renumbering other nodes', () {
    final model = CalculatorModel.reference(CalculatorKind.frame);
    model.remove((type: CalculatorObject.node, id: 'N2'));
    expect(model.nodes.map((n) => n.id), ['N1', 'N3', 'N4']);
    expect(model.members.map((b) => b.id), ['B3']);
    expect(model.validationError, isNull);
  });
  test('deleting a section merges its interval and the last section cannot be removed', () {
    final model = CalculatorModel.reference(CalculatorKind.beam);
    model.sections.first.set('end', 4.0);
    model.sections.add(CalculatorItem('S2', {'start': 4.0, 'end': 8.0, 'shape': 'Rectangle', 'b': 30.0, 'h': 50.0}));
    model.remove((type: CalculatorObject.section, id: 'S1'));
    expect(model.sections.first.number('start'), 0);
    expect(model.validationError, isNull);
    model.remove((type: CalculatorObject.section, id: 'S2'));
    expect(model.sections.length, 1);
  });
  test('invalid ranges and invalid member connections are rejected on persistence', () {
    final beam = CalculatorModel.reference(CalculatorKind.beam);
    beam.loads.first.set('end', 10.0);
    expect(beam.validationError, isNotNull);
    expect(() => CalculatorModel.fromJson(beam.toJson()), throwsFormatException);
    final frame = CalculatorModel.reference(CalculatorKind.frame);
    frame.members.first.set('b', 'N99');
    expect(frame.validationError, isNotNull);
    expect(() => CalculatorModel.fromJson(frame.toJson()), throwsFormatException);
    expect(frame.copy().members.first.text('b'), 'N99', reason: 'Unapplied drafts can still be edited.');
  });
  test('reference diagrams retain the nonzero frame end moments and beam maximum', () {
    expect(CalculatorReference.beamMoment(0), 0);
    expect(CalculatorReference.beamMoment(5), 111);
    expect(CalculatorReference.beamMoment(8), 0);
    expect(CalculatorReference.frameMoment('B2', 0), closeTo(-9.32185, .0001));
    expect(CalculatorReference.frameMoment('B2', 6), closeTo(-37.76236, .0001));
    expect(CalculatorReference.frameMoment('B2', 2.7629957), closeTo(67.01960, .0001));
  });
}
