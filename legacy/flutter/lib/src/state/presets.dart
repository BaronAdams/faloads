/// Named, reusable size presets per structural element category (spec §7:
/// "un gestionnaire... permet de créer des tailles nommées par catégorie
/// d'élément (ex. 'PTR30_40') et de les appliquer en un clic"). Lives at
/// app level (see [AppState] in app_state.dart) — not scoped to a single
/// bâtiment complet visit — and is persisted to disk, so a preset created
/// once survives navigating away and closing the app.
library;

enum PresetCategory { poteau, poutre, voile }

extension PresetCategoryLabel on PresetCategory {
  String get label => switch (this) {
        PresetCategory.poteau => "Poteaux",
        PresetCategory.poutre => "Poutres",
        PresetCategory.voile => "Voiles",
      };
}

class DimensionPreset {
  DimensionPreset({required this.name, required this.aCm, this.bCm});

  String name;

  /// b (poteau/poutre) or épaisseur (voile).
  double aCm;

  /// h — only meaningful for poteau/poutre.
  double? bCm;

  Map<String, dynamic> toJson() => {
        "name": name,
        "aCm": aCm,
        if (bCm != null) "bCm": bCm,
      };

  static DimensionPreset fromJson(Map<String, dynamic> json) => DimensionPreset(
        name: json["name"] as String,
        aCm: (json["aCm"] as num).toDouble(),
        bCm: (json["bCm"] as num?)?.toDouble(),
      );
}
