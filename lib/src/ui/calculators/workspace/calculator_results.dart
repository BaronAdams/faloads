import 'dart:math' as math;
import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';
import 'calculator_model.dart';
import 'calculator_playground.dart';
import 'calculator_widgets.dart';

String calculatorViewTitle(CalculatorView view) => switch (view) {
      CalculatorView.structure => 'Structure',
      CalculatorView.moment => 'Moment M',
      CalculatorView.shear => 'Effort V',
      CalculatorView.normal => 'Effort N',
      CalculatorView.deflection => 'Flèche',
      CalculatorView.rotation => 'Rotation',
    };
String calculatorViewUnit(CalculatorView view) => switch (view) {
      CalculatorView.moment => 'kN·m',
      CalculatorView.shear || CalculatorView.normal => 'kN',
      CalculatorView.deflection => 'mm',
      CalculatorView.rotation => 'mrad',
      _ => '',
    };

class CalculatorViewSelector extends StatelessWidget {
  const CalculatorViewSelector(
      {super.key, required this.frame, required this.value, required this.onChanged, this.resultsAvailable = true});
  final bool frame;
  final CalculatorView value;
  final ValueChanged<CalculatorView> onChanged;
  final bool resultsAvailable;
  @override
  Widget build(BuildContext context) {
    final views = frame
        ? [
            CalculatorView.structure,
            CalculatorView.normal,
            CalculatorView.shear,
            CalculatorView.moment,
            CalculatorView.deflection
          ]
        : [
            CalculatorView.moment,
            CalculatorView.shear,
            CalculatorView.normal,
            CalculatorView.deflection,
            CalculatorView.rotation
          ];
    return Wrap(spacing: 6, runSpacing: 4, children: [
      for (final view in views)
        ChoiceChip(
            selected: value == view,
            label: Text(frame && view == CalculatorView.deflection ? 'Déformée' : calculatorViewTitle(view)),
            labelStyle: const TextStyle(fontFamily: AppTheme.uiFontFamily, fontSize: 12),
            selectedColor: calculatorViolet.withValues(alpha: .25),
            showCheckmark: false,
            tooltip: !resultsAvailable && view != CalculatorView.structure
                ? 'Résultats non disponibles pour ce modèle'
                : null,
            onSelected: resultsAvailable || view == CalculatorView.structure ? (_) => onChanged(view) : null),
    ]);
  }
}

class CalculatorResults extends StatefulWidget {
  const CalculatorResults(
      {super.key,
      required this.model,
      required this.view,
      required this.onView,
      required this.onQuickCalculator,
      required this.onSelectMember,
      this.selection,
      this.compact = false});
  final CalculatorModel model;
  final CalculatorView view;
  final ValueChanged<CalculatorView> onView;
  final VoidCallback onQuickCalculator;
  final ValueChanged<String> onSelectMember;
  final CalculatorSelection? selection;
  final bool compact;
  @override
  State<CalculatorResults> createState() => _CalculatorResultsState();
}

class _CalculatorResultsState extends State<CalculatorResults> {
  double _x = 5, _memberX = 2.76;
  String _member = 'B2';
  Widget _gap() => const SizedBox(height: 12);
  Widget _metrics(List<Widget> cards) => LayoutBuilder(builder: (context, constraints) {
        final columns = constraints.maxWidth >= 650
            ? 3
            : constraints.maxWidth >= 400
                ? 2
                : 1;
        return Wrap(spacing: 10, runSpacing: 10, children: [
          for (final card in cards) SizedBox(width: (constraints.maxWidth - (columns - 1) * 10) / columns, child: card)
        ]);
      });
  Widget _row(String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Wrap(alignment: WrapAlignment.spaceBetween, spacing: 12, runSpacing: 4, children: [
        Text(label, style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        Text(value, style: AppTheme.monoTextStyle(fontSize: 12)),
      ]));
  Widget _equilibrium() =>
      const CalculatorMetric(label: 'Équilibre de l’exemple', value: 'Vérifié', color: calculatorTeal, numeric: false);
  Widget _beam() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CalculatorPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CalculatorViewSelector(frame: false, value: widget.view, onChanged: widget.onView),
          _gap(),
          CalculatorHeading('${calculatorViewTitle(widget.view)} · ${calculatorViewUnit(widget.view)}'),
          CalculatorBeamDiagram(view: widget.view, x: _x, onRead: (x) => setState(() => _x = x)),
          Wrap(spacing: 16, runSpacing: 8, children: [
            Text('x = ${calcNumber(_x)} m', style: AppTheme.monoTextStyle(fontSize: 12)),
            Text(
                '${calculatorViewTitle(widget.view)} : ${calcNumber(CalculatorBeamDiagram.value(widget.view, _x))} ${calculatorViewUnit(widget.view)}',
                style: AppTheme.monoTextStyle(fontSize: 12, color: calculatorViolet)),
          ]),
        ])),
        _gap(),
        _metrics([
          const CalculatorMetric(label: 'Moment maximal', value: '111,00', unit: 'kN·m', color: calculatorViolet),
          const CalculatorMetric(label: 'Flèche maximale', value: '7,64', unit: 'mm'),
          _equilibrium(),
        ]),
        _gap(),
        CalculatorPanel(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: ExpansionTile(
                key: const PageStorageKey('calculator-beam-reactions'),
                tilePadding: EdgeInsets.zero,
                title: const Text('Détails et réactions', style: TextStyle(fontSize: 14)),
                children: [
                  _row('Appui A · x = 0 m', 'Ry = 51,00 kN'),
                  _row('Appui B · x = 8 m', 'Ry = 37,00 kN'),
                  _row('Effort tranchant', '−37,00 à 51,00 kN'),
                  _row('Position de M max', 'x = 5,00 m'),
                  _row('Position de la flèche max', 'x = 4,00 m'),
                  _row('Rapport L/f', '1047'),
                  _row('Effort normal', '0,00 kN'),
                ])),
      ]);
  Widget _frame() {
    final id = widget.selection?.type == CalculatorObject.member ? widget.selection!.id : _member;
    final member = const ['B1', 'B2', 'B3'].contains(id) ? id : 'B2';
    final length = member == 'B2' ? 6.0 : 4.0;
    final x = _memberX.clamp(0.0, length);
    final moment = switch (member) { 'B1' => 9.321849806, 'B3' => 37.762361735, _ => 67.019604451 };
    final normal = switch (member) { 'B1' => -55.259914678, 'B3' => -64.740085322, _ => -16.317963453 };
    final shear = switch (member) { 'B1' => 1.317963453, 'B3' => 16.317963453, _ => 64.740085322 };
    final details = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      CalculatorChoice(
          label: 'Résultats de la barre',
          value: member,
          options: const ['B1', 'B2', 'B3'],
          numeric: true,
          onChanged: (value) {
            widget.onSelectMember(value);
            setState(() {
              _member = value;
              _memberX = 0;
            });
          }),
      _gap(),
      _row('Effort normal N', '${calcNumber(normal)} kN'),
      _row('|V| maximal', '${calcNumber(shear)} kN'),
      _gap(),
      CalculatorNumberField(
          key: ValueKey(member),
          label: 'Lecture sur $member : x',
          value: math.min(_memberX, length),
          unit: 'm',
          maximum: length,
          onChanged: (value) => setState(() => _memberX = value)),
      _gap(),
      _row('Moment en x = ${calcNumber(x)} m', '${calcNumber(CalculatorReference.frameMoment(member, x))} kN·m'),
    ]);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _metrics([
        CalculatorMetric(label: '|M| max · $member', value: calcNumber(moment), unit: 'kN·m', color: calculatorViolet),
        const CalculatorMetric(label: 'Déplacement nodal max', value: '2,29', unit: 'mm'),
        _equilibrium(),
      ]),
      _gap(),
      if (widget.compact)
        CalculatorPanel(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: ExpansionTile(
                key: const PageStorageKey('calculator-frame-member-results'),
                tilePadding: EdgeInsets.zero,
                title: const Text('Résultats par barre', style: TextStyle(fontSize: 14)),
                subtitle: Text('$member · N ${calcNumber(normal)} kN · |V|max ${calcNumber(shear)} kN',
                    style: AppTheme.monoTextStyle(fontSize: 11)),
                children: [details, _gap()]))
      else
        CalculatorPanel(child: details),
      _gap(),
      CalculatorPanel(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: ExpansionTile(
              key: const PageStorageKey('calculator-frame-reactions'),
              tilePadding: EdgeInsets.zero,
              title: const Text('Réactions d’appui', style: TextStyle(fontSize: 14)),
              children: [
                _row('N1 · Rx', '1,32 kN'),
                _row('N1 · Ry', '55,26 kN'),
                _row('N1 · Mz', '4,05 kN·m'),
                const Divider(),
                _row('N4 · Rx', '−16,32 kN'),
                _row('N4 · Ry', '64,74 kN'),
                _row('N4 · Mz', '27,51 kN·m'),
              ])),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.model.isReference) {
      return CalculatorPanel(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const CalculatorHeading('Résultats du modèle'),
        const CalculatorNotice(
            'Ce modèle a été modifié. Aucun résultat de calcul ne lui est encore associé. Les valeurs de l’exemple ne sont pas réutilisées.'),
        _gap(),
        OutlinedButton.icon(
            onPressed: widget.onQuickCalculator,
            icon: const Icon(Icons.calculate_outlined),
            label: const Text('Ouvrir le calcul simplifié G/Q')),
      ]));
    }
    return widget.model.kind == CalculatorKind.beam ? _beam() : _frame();
  }
}
