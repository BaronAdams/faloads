import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_theme.dart';
import '../beam_quick_calc_screen.dart';
import '../frame_quick_calc_screen.dart';
import 'calculator_forms.dart';
import 'calculator_model.dart';
import 'calculator_playground.dart';
import 'calculator_results.dart';
import 'calculator_widgets.dart';

/// Responsive presentation of the approved calculator designs. Model editing
/// and camera state are independent; the existing G/Q calculators remain
/// available while these pages use explicitly identified HTML reference data.
class CalculatorPage extends StatefulWidget {
  const CalculatorPage({super.key, required this.kind});
  final CalculatorKind kind;
  @override
  State<CalculatorPage> createState() => _CalculatorPageState();
}

class _CalculatorPageState extends State<CalculatorPage> {
  late CalculatorModel _model = CalculatorModel.reference(widget.kind);
  CalculatorModel? _editingModel;
  CalculatorSelection? _selection;
  final List<CalculatorModel> _undo = [], _redo = [];
  int _mobileTab = 0, _inspectorTab = 0, _revision = 0;
  bool _desktop = false, _saved = false;
  CalculatorView _view = CalculatorView.moment;
  double _amplification = 100;
  bool _saving = false;
  @override
  void initState() {
    super.initState();
    if (widget.kind == CalculatorKind.frame) {
      _selection = (type: CalculatorObject.member, id: 'B2');
      _inspectorTab = 1;
      _view = CalculatorView.structure;
    }
    _restore();
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_model.storageKey);
      if (raw == null || !mounted || _revision != 0) return;
      final restored = CalculatorModel.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
      if (restored.kind != widget.kind) return;
      setState(() {
        _model = restored;
        _selection = null;
        _inspectorTab = 0;
        _saved = true;
        _revision++;
      });
    } catch (_) {
      // A corrupt or newer local snapshot must not prevent opening the page.
    }
  }

  void _commit(CalculatorModel next) {
    if (!mounted) return;
    final error = next.validationError;
    if (error != null) {
      _message(error);
      return;
    }
    setState(() {
      _undo.add(_model.copy());
      if (_undo.length > 30) _undo.removeAt(0);
      _redo.clear();
      _model = next.copy();
      if (widget.kind == CalculatorKind.frame && !_model.isReference) _view = CalculatorView.structure;
      _editingModel = null;
      _saved = false;
      _revision++;
      if (_selection != null && _model.item(_selection!) == null) _selection = null;
    });
    FocusManager.instance.primaryFocus?.unfocus();
  }

  void _history(bool redo) {
    final source = redo ? _redo : _undo, destination = redo ? _undo : _redo;
    if (source.isEmpty) return;
    setState(() {
      destination.add(_model.copy());
      _model = source.removeLast();
      _selection = null;
      _editingModel = null;
      _inspectorTab = 0;
      _saved = false;
      _revision++;
    });
  }

  void _message(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final snapshot = jsonEncode(_model.toJson()), revision = _revision;
      final prefs = await SharedPreferences.getInstance();
      final ok = await prefs.setString(_model.storageKey, snapshot);
      if (!mounted) return;
      if (!ok) throw StateError('Échec de l’enregistrement');
      setState(() => _saved = revision == _revision);
      _message('Modèle enregistré sur cet appareil.');
    } catch (_) {
      _message('Enregistrement impossible. Réessayez.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _quickCalculator() => Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => widget.kind == CalculatorKind.beam ? const BeamQuickCalcScreen() : const FrameQuickCalcScreen()));
  void _cancelInspector() => setState(() {
        _editingModel = null;
        _selection = null;
        _inspectorTab = 0;
      });
  void _delete(CalculatorSelection selection) {
    final next = _model.copy()..remove(selection);
    _commit(next);
    _cancelInspector();
  }

  Future<void> _edit(CalculatorSelection selection, {CalculatorModel? candidate}) async {
    final model = candidate ?? _model;
    if (model.item(selection) == null) return;
    if (_desktop) {
      setState(() {
        _selection = selection;
        _editingModel = candidate;
        _inspectorTab = 1;
      });
      return;
    }
    setState(() {
      _selection = selection;
      _mobileTab = 1;
    });
    final result = await showModalBottomSheet<CalculatorModel>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Theme.of(context).colorScheme.surface,
        showDragHandle: true,
        builder: (sheetContext) {
          final media = MediaQuery.of(sheetContext);
          return Padding(
            padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
            child: SizedBox(
              height:
                  math.min(640.0, math.max(0.0, media.size.height - media.padding.top - media.viewInsets.bottom - 40)),
              child: CalculatorElementForm(
                model: model,
                selection: selection,
                compact: true,
                onCancel: () => Navigator.pop(sheetContext),
                onApply: (value) => Navigator.pop(sheetContext, value),
                onDelete: candidate != null
                    ? null
                    : () {
                        final next = _model.copy()..remove(selection);
                        Navigator.pop(sheetContext, next);
                      },
              ),
            ),
          );
        });
    if (!mounted) return;
    if (result != null) _commit(result);
  }

  Future<void> _add([CalculatorObject? requested]) async {
    if (requested == null || (requested == CalculatorObject.load && widget.kind == CalculatorKind.beam)) {
      final options = widget.kind == CalculatorKind.beam
          ? [
              ('Appui', CalculatorObject.support, 'support'),
              ('Force ponctuelle', CalculatorObject.load, 'force'),
              ('Charge répartie', CalculatorObject.load, 'distributed'),
              ('Moment concentré', CalculatorObject.load, 'moment'),
              ('Rotule', CalculatorObject.hinge, 'hinge'),
              ('Tronçon de section', CalculatorObject.section, 'section')
            ]
          : [
              ('Nœud', CalculatorObject.node, 'node'),
              ('Barre', CalculatorObject.member, 'member'),
              ('Charge nodale', CalculatorObject.load, 'nodeLoad')
            ];
      final choice = await showModalBottomSheet<(CalculatorObject, String)>(
          context: context,
          useSafeArea: true,
          showDragHandle: true,
          builder: (context) => SingleChildScrollView(
              child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const CalculatorHeading('Ajouter un élément'),
                    for (final option in options)
                      ListTile(
                          title: Text(option.$1),
                          leading: const Icon(Icons.add_circle_outline),
                          onTap: () => Navigator.pop(context, (option.$2, option.$3))),
                  ]))));
      if (choice != null && mounted) _create(choice.$1, choice.$2);
    } else {
      _create(requested, requested.name);
    }
  }

  Future<void> _create(CalculatorObject type, String variant) async {
    if (type == CalculatorObject.load && widget.kind == CalculatorKind.frame) {
      if (_model.nodes.isEmpty) {
        _message('Ajoutez un nœud avant de placer une charge.');
        return;
      }
      final node = await showModalBottomSheet<String>(
          context: context,
          useSafeArea: true,
          showDragHandle: true,
          builder: (context) => SingleChildScrollView(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Padding(padding: EdgeInsets.all(16), child: Text('Nœud recevant la charge')),
                for (final n in _model.nodes)
                  ListTile(
                      title: Text(n.id, style: AppTheme.monoTextStyle()), onTap: () => Navigator.pop(context, n.id)),
                const SizedBox(height: 16),
              ])));
      if (node != null && mounted) _edit((type: CalculatorObject.node, id: node));
      return;
    }
    if (type == CalculatorObject.member && _model.nodes.length < 2) {
      _message('Ajoutez au moins deux nœuds pour relier une barre.');
      return;
    }
    final candidate = _model.copy(), id = _model.nextId(type);
    final item = switch (type) {
      CalculatorObject.support => CalculatorItem(id, {'x': _model.length / 2, 'type': 'Appui simple'}),
      CalculatorObject.hinge => CalculatorItem(id, {'x': _model.length / 2}),
      CalculatorObject.node =>
        CalculatorItem(id, {'x': 0.0, 'y': 0.0, 'support': 'Aucun', 'fx': 0.0, 'fy': 0.0, 'moment': 0.0}),
      CalculatorObject.member => CalculatorItem(id,
          {'a': _model.nodes.first.id, 'b': _model.nodes.last.id, 'width': 30.0, 'height': 30.0, 'w': 0.0, 'q': 0.0}),
      CalculatorObject.load => variant == 'distributed'
          ? CalculatorItem(id, {'type': variant, 'start': 0.0, 'end': _model.length, 'value': 10.0, 'endValue': 10.0})
          : CalculatorItem(id, {
              'type': variant == 'moment' ? 'moment' : 'force',
              'x': _model.length / 2,
              'value': 10.0,
              'horizontal': 0.0
            }),
      CalculatorObject.section => CalculatorItem(id, {..._model.sections.last.values}),
    };
    if (type == CalculatorObject.section) {
      final last = candidate.sections.last;
      final middle = (last.number('start') + last.number('end')) / 2;
      item.set('start', middle);
      last.set('end', middle);
    }
    candidate.items(type).add(item);
    _edit((type: type, id: id), candidate: candidate);
  }

  Widget _modelForm() => CalculatorModelForm(
      key: ValueKey('model-$_revision'),
      model: _model,
      onApply: _commit,
      onEdit: (selection) => _edit(selection),
      onAdd: _add);
  Widget _inspector() => Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SegmentedButton<int>(
            style: SegmentedButton.styleFrom(
                selectedBackgroundColor: AppColors.accentBlue,
                selectedForegroundColor: Colors.white,
                textStyle: const TextStyle(fontFamily: AppTheme.uiFontFamily, fontSize: 12)),
            segments: const [
              ButtonSegment(value: 0, label: Text('Modèle')),
              ButtonSegment(value: 1, label: Text('Élément'))
            ],
            selected: {_inspectorTab},
            showSelectedIcon: false,
            onSelectionChanged: (v) => setState(() => _inspectorTab = v.first)),
        const SizedBox(height: 20),
        if (_inspectorTab == 1 && _selection != null && (_editingModel ?? _model).item(_selection!) != null)
          CalculatorElementForm(
              key: ValueKey('element-$_revision-${_selection!.type}-${_selection!.id}-${_editingModel != null}'),
              model: _editingModel ?? _model,
              selection: _selection!,
              onApply: _commit,
              onCancel: _cancelInspector,
              onDelete: _editingModel != null ? null : () => _delete(_selection!))
        else
          _modelForm(),
      ]));
  Widget _resultPane() => CalculatorResults(
      key: ValueKey('results-$_revision'),
      model: _model,
      view: _view == CalculatorView.structure ? CalculatorView.moment : _view,
      onView: (view) => setState(() => _view = view),
      onQuickCalculator: _quickCalculator,
      selection: _selection,
      onSelectMember: (id) => setState(() => _selection = (type: CalculatorObject.member, id: id)),
      compact: _desktop);
  Widget _scene() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (widget.kind == CalculatorKind.frame) ...[
          CalculatorViewSelector(
              frame: true,
              resultsAvailable: _model.isReference,
              value: _view,
              onChanged: (view) => setState(() => _view = view)),
          if (_view == CalculatorView.deflection)
            CalculatorPanel(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Amplification ×${_amplification.round()}', style: AppTheme.monoTextStyle(fontSize: 12)),
              Slider(value: _amplification, min: 10, max: 500, onChanged: (v) => setState(() => _amplification = v)),
            ])),
          const SizedBox(height: 8),
        ],
        CalculatorPlayground(
            model: _model,
            selection: _selection,
            onSelect: (selection) => _edit(selection),
            onAdd: _add,
            view: widget.kind == CalculatorKind.frame ? _view : CalculatorView.structure,
            amplification: _amplification),
        const SizedBox(height: 12),
        _resultPane(),
      ]);
  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, constraints) {
        _desktop = constraints.maxWidth >= 1000;
        return Scaffold(
          appBar: AppBar(
              titleSpacing: 8,
              title: Text(_desktop ? _model.title : _model.shortTitle,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              actions: [
                if (_desktop)
                  Text(_saved ? 'Enregistré' : 'Brouillon',
                      style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                if (_desktop) const SizedBox(width: 10),
                if (!_desktop)
                  IconButton(
                      key: const Key('save-calculator'),
                      tooltip: 'Enregistrer le modèle',
                      onPressed: _saving ? null : _save,
                      icon: Icon(_saved ? Icons.check_circle_outline : Icons.save_outlined)),
                if (_desktop)
                  Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilledButton(
                          key: const Key('save-calculator'),
                          onPressed: _saving ? null : _save,
                          child: const Text('Enregistrer'))),
                PopupMenuButton<String>(
                    tooltip: 'Options du calculateur',
                    onSelected: (action) async {
                      if (action == 'reset') _commit(CalculatorModel.reference(widget.kind));
                      if (action == 'quick') _quickCalculator();
                      if (action == 'copy') {
                        await Clipboard.setData(
                            ClipboardData(text: const JsonEncoder.withIndent('  ').convert(_model.toJson())));
                        _message('Modèle copié.');
                      }
                    },
                    itemBuilder: (_) => const [
                          PopupMenuItem(value: 'reset', child: Text('Recharger l’exemple')),
                          PopupMenuItem(value: 'copy', child: Text('Copier le modèle')),
                          PopupMenuItem(value: 'quick', child: Text('Calcul simplifié G/Q'))
                        ]),
              ]),
          body: Column(children: [
            Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(children: [
                  Expanded(
                      child: Align(
                          alignment: Alignment.centerLeft,
                          child: PopupMenuButton<String>(
                            tooltip: 'Choisir un modèle',
                            onSelected: (preset) => _commit(CalculatorModel.preset(widget.kind, preset)),
                            itemBuilder: (_) => [
                              PopupMenuItem(
                                  value: 'reference',
                                  child: Text(widget.kind == CalculatorKind.beam
                                      ? 'Poutre isostatique · Exemple'
                                      : 'Portique simple · Exemple')),
                              if (widget.kind == CalculatorKind.beam) ...const [
                                PopupMenuItem(value: 'blank', child: Text('Nouvelle poutre')),
                                PopupMenuItem(value: 'continuous', child: Text('Continue · 2 travées')),
                                PopupMenuItem(value: 'cantilever', child: Text('Console')),
                              ] else
                                const PopupMenuItem(value: 'multistorey', child: Text('2 niveaux · 2 travées')),
                            ],
                            child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Flexible(
                                      child: Text(
                                          _model.isReference
                                              ? (widget.kind == CalculatorKind.beam
                                                  ? 'Poutre isostatique · Exemple de référence'
                                                  : 'Portique simple · Exemple de référence')
                                              : 'Modèle personnalisé',
                                          style: TextStyle(fontSize: 12, color: AppColors.textSecondary))),
                                  const SizedBox(width: 6),
                                  const Icon(Icons.expand_more, size: 18),
                                ])),
                          ))),
                  IconButton(
                      tooltip: 'Annuler la modification',
                      onPressed: _undo.isEmpty ? null : () => _history(false),
                      icon: const Icon(Icons.undo, size: 20)),
                  IconButton(
                      tooltip: 'Rétablir la modification',
                      onPressed: _redo.isEmpty ? null : () => _history(true),
                      icon: const Icon(Icons.redo, size: 20)),
                ])),
            Expanded(
                child: _desktop
                    ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        SizedBox(width: 330, child: SingleChildScrollView(child: _inspector())),
                        const VerticalDivider(width: 1),
                        Expanded(
                            child: SingleChildScrollView(
                                padding: const EdgeInsets.fromLTRB(16, 8, 20, 24), child: _scene())),
                      ])
                    : IndexedStack(index: _mobileTab, children: [
                        SingleChildScrollView(
                            key: const PageStorageKey('calculator-model-scroll'),
                            padding: const EdgeInsets.all(16),
                            child: _modelForm()),
                        SingleChildScrollView(
                            key: const PageStorageKey('calculator-scene-scroll'),
                            padding: const EdgeInsets.all(12),
                            child: _scene()),
                        SingleChildScrollView(
                            key: const PageStorageKey('calculator-results-scroll'),
                            padding: const EdgeInsets.all(12),
                            child: Column(children: [
                              if (widget.kind == CalculatorKind.frame) ...[
                                CalculatorViewSelector(
                                    resultsAvailable: _model.isReference,
                                    frame: true,
                                    value: _view,
                                    onChanged: (v) => setState(() => _view = v)),
                                const SizedBox(height: 8),
                                CalculatorPlayground(
                                    model: _model,
                                    selection: _selection,
                                    onSelect: (selection) => _edit(selection),
                                    onAdd: _add,
                                    view: !_model.isReference
                                        ? CalculatorView.structure
                                        : _view == CalculatorView.structure
                                            ? CalculatorView.moment
                                            : _view,
                                    amplification: _amplification),
                                const SizedBox(height: 12),
                              ],
                              _resultPane(),
                            ])),
                      ])),
          ]),
          bottomNavigationBar: _desktop
              ? null
              : BottomNavigationBar(
                  currentIndex: _mobileTab,
                  onTap: (tab) => setState(() {
                        _mobileTab = tab;
                        if (tab == 2 &&
                            widget.kind == CalculatorKind.frame &&
                            _model.isReference &&
                            _view == CalculatorView.structure) {
                          _view = CalculatorView.moment;
                        }
                      }),
                  items: const [
                      BottomNavigationBarItem(icon: Icon(Icons.tune), label: 'Modèle'),
                      BottomNavigationBarItem(icon: Icon(Icons.polyline_outlined), label: 'Schéma'),
                      BottomNavigationBarItem(icon: Icon(Icons.query_stats), label: 'Résultats')
                    ]),
        );
      });
}
