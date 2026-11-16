import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';
import 'calculator_model.dart';
import 'calculator_widgets.dart';

class CalculatorModelForm extends StatefulWidget {
  const CalculatorModelForm(
      {super.key, required this.model, required this.onApply, required this.onEdit, required this.onAdd});
  final CalculatorModel model;
  final ValueChanged<CalculatorModel> onApply;
  final ValueChanged<CalculatorSelection> onEdit;
  final ValueChanged<CalculatorObject> onAdd;
  @override
  State<CalculatorModelForm> createState() => _CalculatorModelFormState();
}

class _CalculatorModelFormState extends State<CalculatorModelForm> {
  final _form = GlobalKey<FormState>();
  late final CalculatorModel _draft = widget.model.copy();
  bool _showMembers = false;
  String? _error;
  Widget _gap([double height = 12]) => SizedBox(height: height);
  Widget _sectionFields(CalculatorItem section) => Column(children: [
        CalculatorPair(
          first: CalculatorNumberField(
              label: 'Largeur b',
              value: section.number('b'),
              unit: 'cm',
              minimum: .1,
              onChanged: (v) => section.set('b', v)),
          second: CalculatorNumberField(
              label: 'Hauteur h',
              value: section.number('h'),
              unit: 'cm',
              minimum: .1,
              onChanged: (v) => section.set('h', v)),
        ),
      ]);
  Widget _listItem(String title, String subtitle, CalculatorSelection selection, {IconData icon = Icons.tune}) =>
      ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon, size: 20, color: AppColors.accentBlue),
          title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          subtitle: Text(subtitle, style: AppTheme.monoTextStyle(fontSize: 11, color: AppColors.textSecondary)),
          trailing: const Icon(Icons.chevron_right, size: 20),
          onTap: () => widget.onEdit(selection));
  Widget _beamFields() => Column(children: [
        CalculatorPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const CalculatorHeading('Géométrie'),
          CalculatorNumberField(
              label: 'Longueur',
              value: _draft.length,
              unit: 'm',
              minimum: .2,
              maximum: 1000,
              onChanged: _draft.resizeBeam),
        ])),
        _gap(),
        CalculatorPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const CalculatorHeading('Matériau & section'),
          _material(),
          _gap(),
          if (_draft.sections.length == 1 && _draft.sections.first.text('shape', 'Rectangle') == 'Rectangle')
            _sectionFields(_draft.sections.first),
          for (final section in _draft.sections)
            _listItem(
                'Tronçon ${section.id}',
                '${calcNumber(section.number('start'))} → ${calcNumber(section.number('end'))} m',
                (type: CalculatorObject.section, id: section.id),
                icon: Icons.crop_landscape),
          TextButton.icon(
              onPressed: () => widget.onAdd(CalculatorObject.section),
              icon: const Icon(Icons.add),
              label: const Text('Ajouter un tronçon')),
        ])),
        _gap(),
        CalculatorPanel(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: ExpansionTile(
              key: const PageStorageKey('calculator-beam-supports'),
              tilePadding: EdgeInsets.zero,
              title: Text('Appuis · ${_draft.supports.length}', style: const TextStyle(fontSize: 14)),
              children: [
                for (final s in _draft.supports)
                  _listItem('Appui ${s.id} · ${s.text('type')}', 'x = ${calcNumber(s.number('x'))} m',
                      (type: CalculatorObject.support, id: s.id)),
                TextButton.icon(
                    onPressed: () => widget.onAdd(CalculatorObject.support),
                    icon: const Icon(Icons.add),
                    label: const Text('Ajouter un appui'))
              ],
            )),
        _gap(),
        CalculatorPanel(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: ExpansionTile(
              key: const PageStorageKey('calculator-beam-loads'),
              tilePadding: EdgeInsets.zero,
              title: Text('Charges · ${_draft.loads.length}', style: const TextStyle(fontSize: 14)),
              children: [
                for (final l in _draft.loads)
                  _listItem(
                      '${l.id} · ${l.text('type') == 'distributed' ? 'Répartie' : l.text('type') == 'moment' ? 'Moment' : 'Force'}',
                      '${calcNumber(l.number('value'))} ${l.text('type') == 'distributed' ? 'kN/m' : l.text('type') == 'moment' ? 'kN·m' : 'kN'}',
                      (type: CalculatorObject.load, id: l.id),
                      icon: Icons.south),
                TextButton.icon(
                    onPressed: () => widget.onAdd(CalculatorObject.load),
                    icon: const Icon(Icons.add),
                    label: const Text('Ajouter une charge'))
              ],
            )),
        if (_draft.hinges.isNotEmpty) ...[
          _gap(),
          CalculatorPanel(
              child: Column(children: [
            for (final h in _draft.hinges)
              _listItem(
                  'Rotule ${h.id}', 'x = ${calcNumber(h.number('x'))} m', (type: CalculatorObject.hinge, id: h.id)),
          ]))
        ],
      ]);
  Widget _material() => Column(children: [
        CalculatorChoice(
            label: 'Matériau',
            value: _draft.material,
            options: const ['Béton', 'Acier', 'Bois', 'Personnalisé'],
            onChanged: (value) {
              setState(() {
                _draft.material = value;
                _draft.young = switch (value) { 'Acier' => 210, 'Bois' => 11.5, _ => 30 };
              });
            }),
        _gap(),
        CalculatorNumberField(
            key: ValueKey(_draft.material),
            label: 'Module E',
            value: _draft.young,
            unit: 'GPa',
            minimum: .001,
            onChanged: (v) => _draft.young = v),
      ]);
  Widget _frameFields() => Column(children: [
        CalculatorPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const CalculatorHeading('Matériau'),
          _material(),
        ])),
        _gap(),
        CalculatorPanel(
            child: Column(children: [
          SegmentedButton<bool>(
              style: SegmentedButton.styleFrom(
                  selectedBackgroundColor: AppColors.accentBlue,
                  selectedForegroundColor: Colors.white,
                  textStyle: const TextStyle(fontFamily: AppTheme.uiFontFamily, fontSize: 12)),
              segments: [
                ButtonSegment(value: false, label: Text('Nœuds ${_draft.nodes.length}')),
                ButtonSegment(value: true, label: Text('Barres ${_draft.members.length}'))
              ],
              selected: {_showMembers},
              onSelectionChanged: (v) => setState(() => _showMembers = v.first),
              showSelectedIcon: false),
          _gap(),
          if (!_showMembers)
            for (final n in _draft.nodes)
              _listItem(
                  '${n.id} · ${n.text('support')}',
                  'x ${calcNumber(n.number('x'))} · y ${calcNumber(n.number('y'))} m',
                  (type: CalculatorObject.node, id: n.id),
                  icon: Icons.location_on_outlined),
          if (_showMembers)
            for (final b in _draft.members)
              _listItem(
                  '${b.id} · ${b.text('a')} → ${b.text('b')}',
                  '${calcNumber(b.number('width'), 0)} × ${calcNumber(b.number('height'), 0)} cm',
                  (type: CalculatorObject.member, id: b.id),
                  icon: Icons.horizontal_rule),
          OutlinedButton.icon(
              onPressed: () => widget.onAdd(_showMembers ? CalculatorObject.member : CalculatorObject.node),
              icon: const Icon(Icons.add),
              label: Text(_showMembers ? 'Ajouter une barre' : 'Ajouter un nœud')),
        ])),
        _gap(),
        CalculatorPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const CalculatorHeading('Charges nodales'),
          for (final n
              in _draft.nodes.where((n) => n.number('fx') != 0 || n.number('fy') != 0 || n.number('moment') != 0))
            _listItem(n.id, 'Fx ${calcNumber(n.number('fx'))} · Fy ${calcNumber(n.number('fy'))} kN',
                (type: CalculatorObject.node, id: n.id),
                icon: Icons.east),
          TextButton.icon(
              onPressed: () => widget.onAdd(CalculatorObject.load),
              icon: const Icon(Icons.add),
              label: const Text('Ajouter une charge nodale')),
        ])),
      ]);
  void _apply() {
    if (!_form.currentState!.validate()) return;
    setState(() => _error = _draft.validationError);
    if (_error == null) widget.onApply(_draft);
  }

  @override
  Widget build(BuildContext context) => Form(
      key: _form,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const CalculatorHeading('Paramètres du modèle'),
        if (_draft.kind == CalculatorKind.beam) _beamFields() else _frameFields(),
        _gap(),
        CalculatorPanel(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: ExpansionTile(
              key: const PageStorageKey('calculator-model-advanced'),
              tilePadding: EdgeInsets.zero,
              title: const Text('Options avancées', style: TextStyle(fontSize: 14)),
              children: [
                CalculatorNumberField(
                    label: 'Coefficient de Poisson ν',
                    value: _draft.poisson,
                    maximum: .499,
                    onChanged: (v) => _draft.poisson = v),
                _gap(),
                if (_draft.kind == CalculatorKind.beam) ...[
                  SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Cisaillement (Timoshenko)', style: TextStyle(fontSize: 12)),
                      value: _draft.timoshenko,
                      onChanged: (v) => setState(() => _draft.timoshenko = v)),
                  if (_draft.timoshenko)
                    CalculatorNumberField(
                        label: 'Facteur κ',
                        value: _draft.kappa,
                        minimum: .001,
                        maximum: 1,
                        decimals: 4,
                        onChanged: (v) => _draft.kappa = v),
                  SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Poids propre', style: TextStyle(fontSize: 13)),
                      value: _draft.selfWeight,
                      onChanged: (v) => setState(() => _draft.selfWeight = v)),
                  if (_draft.selfWeight)
                    CalculatorNumberField(
                        label: 'Poids volumique',
                        value: _draft.density,
                        unit: 'kN/m³',
                        onChanged: (v) => _draft.density = v),
                  TextButton.icon(
                      onPressed: () => widget.onAdd(CalculatorObject.hinge),
                      icon: const Icon(Icons.add_circle_outline),
                      label: const Text('Ajouter une rotule')),
                ],
                _gap(),
              ],
            )),
        _gap(),
        if (_error != null) ...[CalculatorNotice(_error!, color: AppColors.danger), _gap()],
        FilledButton.icon(
            key: const Key('apply-model'),
            onPressed: _apply,
            icon: const Icon(Icons.check),
            label: const Text('Appliquer')),
      ]));
}

class CalculatorElementForm extends StatefulWidget {
  const CalculatorElementForm(
      {super.key,
      required this.model,
      required this.selection,
      required this.onApply,
      required this.onCancel,
      this.onDelete,
      this.compact = false});
  final CalculatorModel model;
  final CalculatorSelection selection;
  final ValueChanged<CalculatorModel> onApply;
  final VoidCallback onCancel;
  final VoidCallback? onDelete;
  final bool compact;
  @override
  State<CalculatorElementForm> createState() => _CalculatorElementFormState();
}

class _CalculatorElementFormState extends State<CalculatorElementForm> {
  final _form = GlobalKey<FormState>();
  late final CalculatorModel _draft = widget.model.copy();
  late final CalculatorItem _item = _draft.item(widget.selection)!;
  String? _error;
  bool _variable = false;
  @override
  void initState() {
    super.initState();
    _variable = _item.text('type') == 'distributed' && (_item.number('value') - _item.number('endValue')).abs() > 1e-9;
  }

  Widget _gap() => const SizedBox(height: 14);
  Widget _number(String label, String key, {String? unit, double minimum = 0, double? maximum}) =>
      CalculatorNumberField(
          label: label,
          value: _item.number(key),
          unit: unit,
          minimum: minimum,
          maximum: maximum,
          onChanged: (v) => _item.set(key, v));
  Widget _choice(String label, String key, List<String> options, {String? fallback, bool numeric = false}) =>
      CalculatorChoice(
          label: label,
          value: _item.text(key, fallback ?? options.first),
          options: options,
          numeric: numeric,
          onChanged: (v) => setState(() => _item.set(key, v)));
  Widget _direction(String label, String key, String unit, String positive, String negative) =>
      CalculatorDirectionField(
          label: label,
          value: _item.number(key),
          unit: unit,
          positive: positive,
          negative: negative,
          onChanged: (v) {
            _item.set(key, v);
            if (key == 'value' && _item.text('type') == 'distributed' && !_variable) _item.set('endValue', v);
          });
  List<Widget> _fields() {
    switch (widget.selection.type) {
      case CalculatorObject.node:
        return [
          const Text('Coordonnées du modèle, indépendantes du zoom', style: TextStyle(fontSize: 12)),
          _gap(),
          CalculatorPair(
              first: _number('X', 'x', unit: 'm', minimum: -1000, maximum: 1000),
              second: _number('Y', 'y', unit: 'm', minimum: -1000, maximum: 1000)),
          _gap(),
          _choice('Appui externe', 'support',
              const ['Aucun', 'Encastrement', 'Articulation', 'Appui vertical', 'Appui horizontal']),
          _gap(),
          const CalculatorHeading('Charge nodale'),
          _direction('Fx', 'fx', 'kN', 'Droite →', 'Gauche ←'),
          _gap(),
          _direction('Fy', 'fy', 'kN', 'Haut ↑', 'Bas ↓'),
          _gap(),
          _direction('Moment', 'moment', 'kN·m', 'Antihoraire ↺', 'Horaire ↻')
        ];
      case CalculatorObject.member:
        final ids = _draft.nodes.map((n) => n.id).toList();
        return [
          const CalculatorHeading('Extrémités'),
          CalculatorPair(
              first: _choice('Départ', 'a', ids, numeric: true), second: _choice('Arrivée', 'b', ids, numeric: true)),
          _gap(),
          const CalculatorHeading('Section'),
          CalculatorPair(
              first: _number('Largeur b', 'width', unit: 'cm', minimum: .1),
              second: _number('Hauteur h', 'height', unit: 'cm', minimum: .1)),
          _gap(),
          const CalculatorHeading('Charge sur la barre'),
          _direction('Intensité verticale', 'w', 'kN/m', 'Bas ↓', 'Haut ↑'),
          const SizedBox(height: 6),
          const Text('Répartie sur toute la barre', style: TextStyle(fontSize: 12)),
          _gap(),
          ExpansionTile(
              key: const PageStorageKey('calculator-member-local-load'),
              tilePadding: EdgeInsets.zero,
              title: const Text('Charge locale perpendiculaire', style: TextStyle(fontSize: 12)),
              children: [_number('Charge q locale', 'q', unit: 'kN/m', minimum: -1e9), _gap()])
        ];
      case CalculatorObject.support:
        return [
          _number('Position', 'x', unit: 'm', maximum: _draft.length),
          _gap(),
          _choice('Type d’appui', 'type',
              const ['Articulation', 'Appui simple', 'Encastrement', 'Appui élastique', 'Glissière']),
          _gap(),
          if (_item.text('type') == 'Appui élastique') ...[
            CalculatorNumberField(
                label: 'Raideur verticale',
                value: _item.number('stiffness', 10000),
                unit: 'kN/m',
                minimum: .001,
                onChanged: (v) => _item.set('stiffness', v)),
            _gap()
          ],
          ExpansionTile(
              key: const PageStorageKey('calculator-support-displacements'),
              tilePadding: EdgeInsets.zero,
              title: const Text('Déplacements imposés', style: TextStyle(fontSize: 13)),
              children: [
                _number('Tassement vers le bas', 'dy', unit: 'mm', minimum: -1e6),
                _gap(),
                _number('Déplacement horizontal', 'dx', unit: 'mm', minimum: -1e6),
                _gap(),
                _number('Rotation horaire', 'rotation', unit: 'mrad', minimum: -1e6),
                _gap()
              ])
        ];
      case CalculatorObject.hinge:
        return [
          _number('Position de la rotule', 'x', unit: 'm', minimum: .001, maximum: _draft.length - .001),
          _gap(),
          const CalculatorNotice('La rotule se place à l’intérieur de la poutre.')
        ];
      case CalculatorObject.section:
        return [
          CalculatorPair(
              first: _number('Début du tronçon', 'start', unit: 'm', maximum: _draft.length),
              second: _number('Fin du tronçon', 'end', unit: 'm', minimum: .001, maximum: _draft.length)),
          _gap(),
          _choice('Forme de section', 'shape', const ['Rectangle', 'Personnalisée'], fallback: 'Rectangle'),
          _gap(),
          if (_item.text('shape', 'Rectangle') == 'Rectangle')
            CalculatorPair(
                first: _number('Largeur b', 'b', unit: 'cm', minimum: .1),
                second: _number('Hauteur h', 'h', unit: 'cm', minimum: .1))
          else ...[
            _number('Aire A', 'area', unit: 'cm²', minimum: .001),
            _gap(),
            _number('Inertie I', 'inertia', unit: 'cm⁴', minimum: .001),
            _gap(),
            _number('Aire de cisaillement', 'shearArea', unit: 'cm²'),
            _gap(),
          ],
          const CalculatorNotice('Les tronçons doivent se suivre sans intervalle ni chevauchement.')
        ];
      case CalculatorObject.load:
        if (_item.text('type') == 'distributed') {
          return [
            SegmentedButton<bool>(
                style: SegmentedButton.styleFrom(
                    selectedBackgroundColor: AppColors.accentBlue,
                    selectedForegroundColor: Colors.white,
                    textStyle: const TextStyle(fontFamily: AppTheme.uiFontFamily, fontSize: 12)),
                segments: const [
                  ButtonSegment(value: false, label: Text('Uniforme')),
                  ButtonSegment(value: true, label: Text('Variable'))
                ],
                selected: {_variable},
                showSelectedIcon: false,
                onSelectionChanged: (v) => setState(() {
                      _variable = v.first;
                      if (!_variable) _item.set('endValue', _item.number('value'));
                    })),
            _gap(),
            CalculatorPair(
                first: _number('Début', 'start', unit: 'm', maximum: _draft.length),
                second: _number('Fin', 'end', unit: 'm', maximum: _draft.length)),
            _gap(),
            _direction(_variable ? 'Intensité au début' : 'Intensité', 'value', 'kN/m', 'Bas ↓', 'Haut ↑'),
            _gap(),
            if (_variable) ...[_direction('Intensité à la fin', 'endValue', 'kN/m', 'Bas ↓', 'Haut ↑'), _gap()],
            ExpansionTile(
                key: const PageStorageKey('calculator-distributed-axial'),
                tilePadding: EdgeInsets.zero,
                title: const Text('Composantes axiales', style: TextStyle(fontSize: 13)),
                children: [
                  _number('Charge axiale au début', 'axialStart', unit: 'kN/m', minimum: -1e9),
                  _gap(),
                  _number('Charge axiale à la fin', 'axialEnd', unit: 'kN/m', minimum: -1e9),
                  _gap()
                ]),
          ];
        }
        return [
          _number('Position', 'x', unit: 'm', maximum: _draft.length),
          _gap(),
          if (_item.text('type') == 'moment')
            _direction('Moment', 'value', 'kN·m', 'Horaire ↻', 'Antihoraire ↺')
          else ...[
            _direction('Force verticale', 'value', 'kN', 'Vers le bas ↓', 'Vers le haut ↑'),
            _gap(),
            _direction('Force horizontale', 'horizontal', 'kN', 'Droite →', 'Gauche ←')
          ]
        ];
    }
  }

  void _apply() {
    if (!_form.currentState!.validate()) return;
    if (widget.selection.type == CalculatorObject.section) {
      final index = _draft.sections.indexOf(_item);
      if (index > 0) _draft.sections[index - 1].set('end', _item.number('start'));
      if (index < _draft.sections.length - 1) _draft.sections[index + 1].set('start', _item.number('end'));
    }
    setState(() => _error = _draft.validationError);
    if (_error == null) widget.onApply(_draft);
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (widget.selection.type) {
      CalculatorObject.node => 'Nœud',
      CalculatorObject.member => 'Barre',
      CalculatorObject.support => 'Appui',
      CalculatorObject.section => 'Tronçon',
      CalculatorObject.hinge => 'Rotule',
      CalculatorObject.load => _item.text('type') == 'distributed'
          ? 'Charge répartie'
          : _item.text('type') == 'moment'
              ? 'Moment'
              : 'Force',
    };
    final content = Form(
        key: _form,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ..._fields(),
          if (_error != null) ...[_gap(), CalculatorNotice(_error!, color: AppColors.danger)],
        ]));
    final actions = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: OutlinedButton(onPressed: widget.onCancel, child: const Text('Annuler'))),
        const SizedBox(width: 12),
        Expanded(
            child: FilledButton(key: const Key('apply-element'), onPressed: _apply, child: const Text('Appliquer')))
      ]),
      if (widget.onDelete != null)
        TextButton.icon(
            onPressed: widget.onDelete,
            icon: const Icon(Icons.delete_outline, size: 18),
            label: const Text('Supprimer cet élément'),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger)),
    ]);
    if (widget.compact) {
      return SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          CalculatorHeading('$title ${_item.id}',
              trailing: IconButton(
                  tooltip: 'Fermer les paramètres', onPressed: widget.onCancel, icon: const Icon(Icons.close))),
          content,
          _gap(),
          actions,
        ]),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      CalculatorHeading('$title ${_item.id}',
          trailing:
              IconButton(tooltip: 'Revenir au modèle', onPressed: widget.onCancel, icon: const Icon(Icons.close))),
      content,
      _gap(),
      actions,
    ]);
  }
}
