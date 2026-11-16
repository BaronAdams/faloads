import 'dart:convert';
import 'dart:math' as math;

/// Presentation state for the approved calculator pages. This layer does not
/// replace the engineering solvers in domain/beam_analysis.dart.
enum CalculatorKind { beam, frame }

enum CalculatorObject { support, load, hinge, section, node, member }

enum CalculatorView { structure, moment, shear, normal, deflection, rotation }

typedef CalculatorSelection = ({CalculatorObject type, String id});

String calcNumber(double value, [int decimals = 2]) =>
    (value.abs() < math.pow(10, -decimals) / 2 ? 0.0 : value).toStringAsFixed(decimals).replaceAll('.', ',');

class CalculatorItem {
  CalculatorItem(this.id, this.values);
  final String id;
  final Map<String, dynamic> values;
  double number(String key, [double fallback = 0]) => (values[key] as num?)?.toDouble() ?? fallback;
  String text(String key, [String fallback = '']) => values[key] as String? ?? fallback;
  void set(String key, dynamic value) => values[key] = value;
  Map<String, dynamic> toJson() => {'id': id, ...values};
  factory CalculatorItem.fromJson(Map<String, dynamic> json) {
    final fields = Map<String, dynamic>.from(json)..remove('id');
    return CalculatorItem(json['id'] as String, fields);
  }
}

class CalculatorModel {
  CalculatorModel(
      {required this.kind,
      this.length = 8,
      this.young = 30,
      this.material = 'Béton',
      this.poisson = .2,
      this.kappa = 5 / 6,
      this.timoshenko = true,
      this.selfWeight = false,
      this.density = 25,
      List<CalculatorItem>? supports,
      List<CalculatorItem>? loads,
      List<CalculatorItem>? hinges,
      List<CalculatorItem>? sections,
      List<CalculatorItem>? nodes,
      List<CalculatorItem>? members})
      : supports = supports ?? [],
        loads = loads ?? [],
        hinges = hinges ?? [],
        sections = sections ?? [],
        nodes = nodes ?? [],
        members = members ?? [];

  final CalculatorKind kind;
  double length, young, poisson, kappa, density;
  String material;
  bool timoshenko, selfWeight;
  final List<CalculatorItem> supports, loads, hinges, sections, nodes, members;

  String get title => kind == CalculatorKind.beam ? 'Calculateur de poutres' : 'Calculateur de cadres';
  String get shortTitle => kind == CalculatorKind.beam ? 'Poutre' : 'Cadre';
  String get storageKey => 'structcalc.calculator.${kind.name}.v1';
  List<CalculatorItem> items(CalculatorObject type) => switch (type) {
        CalculatorObject.support => supports,
        CalculatorObject.load => loads,
        CalculatorObject.hinge => hinges,
        CalculatorObject.section => sections,
        CalculatorObject.node => nodes,
        CalculatorObject.member => members,
      };
  CalculatorItem? item(CalculatorSelection selection) {
    for (final item in items(selection.type)) {
      if (item.id == selection.id) return item;
    }
    return null;
  }

  String nextId(CalculatorObject type) {
    final prefix = switch (type) {
      CalculatorObject.support => 'A',
      CalculatorObject.load => 'F',
      CalculatorObject.hinge => 'R',
      CalculatorObject.section => 'S',
      CalculatorObject.node => 'N',
      CalculatorObject.member => 'B',
    };
    var number = 1;
    final used = items(type).map((e) => e.id).toSet();
    while (used.contains('$prefix$number')) {
      number++;
    }
    return '$prefix$number';
  }

  CalculatorModel copy() => CalculatorModel.fromJson(toJson(), validate: false);
  Map<String, dynamic> toJson() => {
        'version': 1,
        'kind': kind.name,
        'length': length,
        'young': young,
        'material': material,
        'poisson': poisson,
        'kappa': kappa,
        'timoshenko': timoshenko,
        'selfWeight': selfWeight,
        'density': density,
        for (final type in CalculatorObject.values) type.name: items(type).map((e) => e.toJson()).toList(),
      };
  factory CalculatorModel.fromJson(Map<String, dynamic> json, {bool validate = true}) {
    if (json['version'] != 1) throw const FormatException('Version de modèle inconnue.');
    final model = CalculatorModel(
      kind: CalculatorKind.values.byName(json['kind'] as String),
      length: (json['length'] as num).toDouble(),
      young: (json['young'] as num).toDouble(),
      material: json['material'] as String,
      poisson: (json['poisson'] as num).toDouble(),
      kappa: (json['kappa'] as num).toDouble(),
      density: (json['density'] as num).toDouble(),
      timoshenko: json['timoshenko'] as bool,
      selfWeight: json['selfWeight'] as bool,
    );
    for (final type in CalculatorObject.values) {
      model
          .items(type)
          .addAll((json[type.name] as List).map((e) => CalculatorItem.fromJson(Map<String, dynamic>.from(e as Map))));
    }
    final error = model.validationError;
    if (validate && error != null) throw FormatException(error);
    return model;
  }

  String? get validationError {
    if (!length.isFinite ||
        length <= 0 ||
        !young.isFinite ||
        young <= 0 ||
        !poisson.isFinite ||
        poisson < 0 ||
        poisson >= .5 ||
        !kappa.isFinite ||
        kappa <= 0 ||
        kappa > 1 ||
        !density.isFinite ||
        density < 0) {
      return 'Vérifiez les dimensions et les propriétés du matériau.';
    }
    for (final type in CalculatorObject.values) {
      final ids = items(type).map((e) => e.id).toList();
      if (ids.toSet().length != ids.length) return 'Chaque élément doit avoir un identifiant unique.';
      for (final item in items(type)) {
        for (final value in item.values.values) {
          if (value is num && !value.isFinite) return 'Les valeurs numériques doivent être finies.';
        }
      }
    }
    if (kind == CalculatorKind.beam) {
      for (final s in supports) {
        if (s.number('x') < 0 || s.number('x') > length) return 'Un appui est situé hors de la poutre.';
      }
      for (final h in hinges) {
        if (h.number('x') <= 0 || h.number('x') >= length) return 'Une rotule doit rester à l’intérieur de la poutre.';
      }
      for (final l in loads) {
        if (l.text('type') == 'distributed') {
          if (l.number('start') < 0 || l.number('end') > length || l.number('start') >= l.number('end')) {
            return 'Vérifiez les bornes de la charge répartie.';
          }
        } else if (l.number('x') < 0 || l.number('x') > length) {
          return 'Une charge est située hors de la poutre.';
        }
      }
      if (sections.isEmpty) return 'Ajoutez au moins un tronçon de section.';
      var cursor = 0.0;
      for (final s in sections) {
        if ((s.number('start') - cursor).abs() > 1e-6 || s.number('end') <= cursor) {
          return 'Les tronçons doivent être contigus.';
        }
        if (s.text('shape', 'Rectangle') == 'Rectangle' && (s.number('b') <= 0 || s.number('h') <= 0)) {
          return 'La section doit être positive.';
        }
        if (s.text('shape') == 'Personnalisée' && (s.number('area') <= 0 || s.number('inertia') <= 0)) {
          return 'L’aire et l’inertie doivent être positives.';
        }
        cursor = s.number('end');
      }
      if ((cursor - length).abs() > 1e-6) return 'Les tronçons doivent couvrir toute la poutre.';
    } else {
      final ids = nodes.map((e) => e.id).toSet();
      for (final b in members) {
        if (!ids.contains(b.text('a')) || !ids.contains(b.text('b')) || b.text('a') == b.text('b')) {
          return 'Une barre doit relier deux nœuds distincts.';
        }
        final a = nodes.firstWhere((n) => n.id == b.text('a'));
        final c = nodes.firstWhere((n) => n.id == b.text('b'));
        if (math.sqrt(math.pow(a.number('x') - c.number('x'), 2) + math.pow(a.number('y') - c.number('y'), 2)) < 1e-6) {
          return 'Une barre ne peut pas avoir une longueur nulle.';
        }
        if (b.number('width') <= 0 || b.number('height') <= 0) return 'La section d’une barre doit être positive.';
      }
    }
    return null;
  }

  void resizeBeam(double value) {
    final ratio = value / length;
    for (final s in supports) {
      s.set('x', s.number('x') * ratio);
    }
    for (final h in hinges) {
      h.set('x', h.number('x') * ratio);
    }
    for (final l in loads) {
      if (l.text('type') == 'distributed') {
        l.set('start', l.number('start') * ratio);
        l.set('end', l.number('end') * ratio);
      } else {
        l.set('x', l.number('x') * ratio);
      }
    }
    for (final s in sections) {
      s.set('start', s.number('start') * ratio);
      s.set('end', s.number('end') * ratio);
    }
    length = value;
  }

  void remove(CalculatorSelection selection) {
    final collection = items(selection.type);
    final index = collection.indexWhere((e) => e.id == selection.id);
    if (index < 0) return;
    if (selection.type == CalculatorObject.section) {
      if (sections.length == 1) return;
      final removed = collection.removeAt(index);
      if (index > 0) {
        sections[index - 1].set('end', removed.number('end'));
      } else {
        sections.first.set('start', 0.0);
      }
    } else {
      collection.removeAt(index);
      if (selection.type == CalculatorObject.node) {
        members.removeWhere((e) => e.text('a') == selection.id || e.text('b') == selection.id);
      }
    }
  }

  bool get isReference => jsonEncode(toJson()) == jsonEncode(CalculatorModel.reference(kind).toJson());

  factory CalculatorModel.preset(CalculatorKind kind, String preset) {
    final model = CalculatorModel.reference(kind);
    if (preset == 'reference') return model;
    if (kind == CalculatorKind.beam) {
      if (preset == 'blank') {
        model.resizeBeam(6);
        model.loads.clear();
      } else if (preset == 'cantilever') {
        model.resizeBeam(4);
        model.supports
          ..clear()
          ..add(CalculatorItem('A', {'x': 0.0, 'type': 'Encastrement'}));
        model.sections.first.set('h', 60.0);
        model.loads
          ..clear()
          ..add(
              CalculatorItem('q1', {'type': 'distributed', 'start': 0.0, 'end': 4.0, 'value': 30.0, 'endValue': 10.0}))
          ..add(CalculatorItem('M1', {'type': 'moment', 'x': 4.0, 'value': 20.0}));
      } else if (preset == 'continuous') {
        model.resizeBeam(9);
        model.supports.insert(1, CalculatorItem('C', {'x': 5.0, 'type': 'Appui simple'}));
        model.sections.first.set('end', 5.0);
        model.sections.add(CalculatorItem('S2', {
          'start': 5.0,
          'end': 9.0,
          'shape': 'Personnalisée',
          'area': 1500.0,
          'inertia': 625000.0,
          'shearArea': 1250.0
        }));
        model.loads
          ..clear()
          ..add(
              CalculatorItem('q1', {'type': 'distributed', 'start': 0.0, 'end': 5.0, 'value': 15.0, 'endValue': 15.0}))
          ..add(CalculatorItem('F1', {'type': 'force', 'x': 7.0, 'value': 30.0, 'horizontal': 0.0}));
      }
    } else if (preset == 'multistorey') {
      model.nodes.clear();
      model.members.clear();
      model.length = 12;
      for (var col = 0; col < 3; col++) {
        for (var level = 0; level < 3; level++) {
          final id = 'N${col * 3 + level + 1}';
          model.nodes.add(CalculatorItem(id, {
            'x': col * 6.0,
            'y': level * 3.5,
            'support': level == 0 ? 'Encastrement' : 'Aucun',
            'fx': id == 'N2'
                ? 20.0
                : id == 'N3'
                    ? 10.0
                    : 0.0,
            'fy': 0.0,
            'moment': 0.0
          }));
        }
      }
      const ends = [
        ['N1', 'N2'],
        ['N2', 'N3'],
        ['N4', 'N5'],
        ['N5', 'N6'],
        ['N7', 'N8'],
        ['N8', 'N9'],
        ['N2', 'N5'],
        ['N5', 'N8'],
        ['N3', 'N6'],
        ['N6', 'N9']
      ];
      for (var i = 0; i < ends.length; i++) {
        model.members.add(CalculatorItem('B${i + 1}', {
          'a': ends[i][0],
          'b': ends[i][1],
          'width': 30.0,
          'height': i < 6 ? 30.0 : 50.0,
          'w': i < 6
              ? 0.0
              : i < 8
                  ? 25.0
                  : 20.0,
          'q': 0.0
        }));
      }
    }
    return model;
  }

  factory CalculatorModel.reference(CalculatorKind kind) {
    if (kind == CalculatorKind.beam) {
      return CalculatorModel(kind: kind, supports: [
        CalculatorItem('A', {'x': 0.0, 'type': 'Articulation'}),
        CalculatorItem('B', {'x': 8.0, 'type': 'Appui simple'})
      ], sections: [
        CalculatorItem('S1', {'start': 0.0, 'end': 8.0, 'shape': 'Rectangle', 'b': 30.0, 'h': 50.0})
      ], loads: [
        CalculatorItem('q1', {'type': 'distributed', 'start': 0.0, 'end': 4.0, 'value': 12.0, 'endValue': 12.0}),
        CalculatorItem('F1', {'type': 'force', 'x': 5.0, 'value': 40.0, 'horizontal': 0.0})
      ]);
    }
    return CalculatorModel(kind: kind, length: 6, nodes: [
      CalculatorItem('N1', {'x': 0.0, 'y': 0.0, 'support': 'Encastrement', 'fx': 0.0, 'fy': 0.0, 'moment': 0.0}),
      CalculatorItem('N2', {'x': 0.0, 'y': 4.0, 'support': 'Aucun', 'fx': 15.0, 'fy': 0.0, 'moment': 0.0}),
      CalculatorItem('N3', {'x': 6.0, 'y': 4.0, 'support': 'Aucun', 'fx': 0.0, 'fy': 0.0, 'moment': 0.0}),
      CalculatorItem('N4', {'x': 6.0, 'y': 0.0, 'support': 'Encastrement', 'fx': 0.0, 'fy': 0.0, 'moment': 0.0})
    ], members: [
      CalculatorItem('B1', {'a': 'N1', 'b': 'N2', 'width': 30.0, 'height': 30.0, 'w': 0.0, 'q': 0.0}),
      CalculatorItem('B2', {'a': 'N2', 'b': 'N3', 'width': 30.0, 'height': 50.0, 'w': 20.0, 'q': 0.0}),
      CalculatorItem('B3', {'a': 'N3', 'b': 'N4', 'width': 30.0, 'height': 30.0, 'w': 0.0, 'q': 0.0})
    ]);
  }
}

/// Values of the uploaded HTML examples, shown only while the applied model
/// matches that exact example. Edited models never inherit stale reactions or
/// a green equilibrium status. Wiring a general solver is a separate concern.
class CalculatorReference {
  static double beamMoment(double x) => 51 * x - (x <= 4 ? 6 * x * x : 48 * (x - 2)) - (x >= 5 ? 40 * (x - 5) : 0);
  static double beamShear(double x) => 51 - 12 * math.min(x, 4) - (x >= 5 ? 40 : 0);
  static double frameMoment(String member, double x) => switch (member) {
        'B1' => -4.0499959951 - 1.3179634527 * x,
        'B2' => -9.3218498060 + 55.2599146785 * x - 10 * x * x,
        'B3' => -37.7623617353 + 16.3179634527 * x,
        _ => 0,
      };
}
