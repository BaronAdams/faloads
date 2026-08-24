import "package:flutter/material.dart";

import "../state/app_scope.dart";
import "../state/saved_project.dart";
import "../theme/app_colors.dart";
import "../ui/building/building_flow_screen.dart";
import "../ui/poteau/poteau_flow_screen.dart";
import "../ui/voile/voile_flow_screen.dart";
import "struct_icon.dart";

/// One row for a [SavedProject] — shared by the dashboard's "Projets
/// récents" and "Mon compte"'s "Projets" lists. Tap reopens the right flow
/// screen (via [SavedProject.data]); the trailing button deletes it.
class ProjectTile extends StatelessWidget {
  const ProjectTile({super.key, required this.project});

  final SavedProject project;

  static const _months = [
    "janv.",
    "févr.",
    "mars",
    "avr.",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
  ];

  String get _dateLabel {
    final d = project.savedAt;
    return "${d.day} ${_months[d.month - 1]} ${d.year}";
  }

  StructIconKind get _iconKind => switch (project.type) {
        SavedProjectType.poteau => StructIconKind.column,
        SavedProjectType.voile => StructIconKind.wall,
        SavedProjectType.batiment => StructIconKind.building,
      };

  Widget _reopen() => switch (project.type) {
        SavedProjectType.poteau => PoteauFlowScreen(initialProject: project),
        SavedProjectType.voile => VoileFlowScreen(initialProject: project),
        SavedProjectType.batiment => BuildingFlowScreen(initialProject: project),
      };

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: StructIcon(kind: _iconKind, color: AppColors.accentBlue, size: 20),
      title: Text(project.name, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
      subtitle: Text(
        "${project.type.label} · $_dateLabel",
        style: const TextStyle(fontSize: 11.5, color: AppColors.textTertiary),
      ),
      trailing: IconButton(
        icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.textTertiary),
        onPressed: () => AppScope.of(context).deleteProject(project.id),
      ),
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => _reopen())),
    );
  }
}
