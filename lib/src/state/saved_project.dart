/// A named, resumable snapshot of one calculation flow's inputs — what
/// "Projets récents" on the dashboard actually stores and reopens.
/// [data] is a JSON-compatible blob whose shape only the owning flow
/// screen (poteau/voile/bâtiment) understands; [AppState] just stores and
/// persists it as-is.
library;

enum SavedProjectType { poteau, voile, batiment }

extension SavedProjectTypeLabel on SavedProjectType {
  String get label => switch (this) {
        SavedProjectType.poteau => "Poteau isolé",
        SavedProjectType.voile => "Voile isolé",
        SavedProjectType.batiment => "Bâtiment complet",
      };
}

class SavedProject {
  SavedProject({
    required this.id,
    required this.type,
    required this.name,
    required this.savedAt,
    required this.data,
  });

  final String id;
  final SavedProjectType type;
  final String name;
  final DateTime savedAt;
  final Map<String, dynamic> data;

  Map<String, dynamic> toJson() => {
        "id": id,
        "type": type.name,
        "name": name,
        "savedAt": savedAt.toIso8601String(),
        "data": data,
      };

  static SavedProject fromJson(Map<String, dynamic> json) => SavedProject(
        id: json["id"] as String,
        type: SavedProjectType.values.byName(json["type"] as String),
        name: json["name"] as String,
        savedAt: DateTime.parse(json["savedAt"] as String),
        data: Map<String, dynamic>.from(json["data"] as Map),
      );
}
