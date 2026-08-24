import "package:flutter/material.dart";

import "../../state/app_scope.dart";
import "../../state/saved_project.dart";
import "../../theme/app_colors.dart";
import "../../widgets/empty_state.dart";
import "../../widgets/struct_icon.dart";
import "../building/building_flow_screen.dart";
import "../poteau/poteau_flow_screen.dart";
import "../predim/predim_screen.dart";
import "../voile/voile_flow_screen.dart";

class _CalcEntry {
  const _CalcEntry({
    required this.iconKind,
    required this.label,
    required this.destination,
    this.iconColor = AppColors.accentBlue,
    this.badge,
  });

  final StructIconKind iconKind;
  final Color iconColor;
  final String label;
  final String? badge;
  final Widget Function() destination;
}

/// Dashboard / "Calculs" home (spec §2): two calculation families —
/// Prédimensionnement (6 element types) and Descente de charges (poteau /
/// voile / bâtiment complet) — plus a recent-projects list that starts
/// empty.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  static final List<_CalcEntry> _predim = [
    _CalcEntry(
      iconKind: StructIconKind.column,
      label: "Poteau",
      destination: () => const PredimScreen(initialType: PredimElementType.poteau),
    ),
    _CalcEntry(
      iconKind: StructIconKind.beam,
      iconColor: AppColors.accentAmber,
      label: "Poutre",
      destination: () => const PredimScreen(initialType: PredimElementType.poutre),
    ),
    _CalcEntry(
      iconKind: StructIconKind.wall,
      iconColor: AppColors.accentTeal,
      label: "Voile",
      destination: () => const PredimScreen(initialType: PredimElementType.voile),
    ),
    _CalcEntry(
      iconKind: StructIconKind.slab,
      iconColor: AppColors.accentTeal,
      label: "Plancher",
      destination: () => const PredimScreen(initialType: PredimElementType.plancher),
    ),
    _CalcEntry(
      iconKind: StructIconKind.balcony,
      iconColor: AppColors.accentTeal,
      label: "Balcon",
      destination: () => const PredimScreen(initialType: PredimElementType.balcon),
    ),
    _CalcEntry(
      iconKind: StructIconKind.stairs,
      label: "Escalier",
      destination: () => const PredimScreen(initialType: PredimElementType.escalier),
    ),
  ];

  static final List<_CalcEntry> _descente = [
    _CalcEntry(iconKind: StructIconKind.column, label: "Poteau isolé", destination: () => const PoteauFlowScreen()),
    _CalcEntry(
      iconKind: StructIconKind.wall,
      iconColor: AppColors.accentTeal,
      label: "Voile isolé",
      destination: () => const VoileFlowScreen(),
    ),
    _CalcEntry(
      iconKind: StructIconKind.building,
      label: "Bâtiment complet",
      badge: "Pro",
      destination: () => const BuildingFlowScreen(),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text("StructCalc")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          const _SectionTitle(
            title: "Prédimensionnement",
            subtitle: "Dimensionner un élément seul, sans modélisation",
          ),
          const SizedBox(height: 10),
          _CalcGrid(entries: _predim, crossAxisCount: 3, annotation: StructIconAnnotation.dimensions),
          const SizedBox(height: 24),
          const _SectionTitle(
            title: "Descente de charges",
            subtitle: "Cheminement complet des charges jusqu'aux fondations",
          ),
          const SizedBox(height: 10),
          _CalcGrid(entries: _descente, crossAxisCount: 2, annotation: StructIconAnnotation.load),
          const SizedBox(height: 24),
          const _SectionTitle(title: "Projets récents"),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: app.recentProjects.isEmpty
                ? const EmptyState(
                    icon: Icons.folder_open_outlined,
                    title: "Aucun projet pour l'instant",
                    message: "Lancez un calcul ci-dessus — il apparaîtra ici automatiquement.",
                  )
                : Column(
                    children: [
                      for (final p in app.recentProjects) _ProjectTile(project: p),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _ProjectTile extends StatelessWidget {
  const _ProjectTile({required this.project});

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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(subtitle!, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary)),
        ],
      ],
    );
  }
}

class _CalcGrid extends StatelessWidget {
  const _CalcGrid({required this.entries, required this.crossAxisCount, required this.annotation});

  final List<_CalcEntry> entries;
  final int crossAxisCount;
  final StructIconAnnotation annotation;

  static const double _spacing = 10;

  @override
  Widget build(BuildContext context) {
    // A plain Wrap instead of GridView.builder(shrinkWrap: true, ...): a
    // shrink-wrapped, non-scrolling grid nested inside an already-scrolling
    // ListView is a known-finicky combination (it forces an extra,
    // sometimes unreliable layout pass) — Wrap sidesteps that entirely by
    // never claiming to be a scrollable in the first place.
    final aspectRatio = crossAxisCount == 3 ? 0.95 : 1.7;
    return LayoutBuilder(
      builder: (context, constraints) {
        final cardWidth = (constraints.maxWidth - _spacing * (crossAxisCount - 1)) / crossAxisCount;
        return Wrap(
          spacing: _spacing,
          runSpacing: _spacing,
          children: [
            for (final entry in entries)
              SizedBox(
                width: cardWidth,
                height: cardWidth / aspectRatio,
                child: _CalcCard(entry: entry, annotation: annotation),
              ),
          ],
        );
      },
    );
  }
}

class _CalcCard extends StatelessWidget {
  const _CalcCard({required this.entry, required this.annotation});

  final _CalcEntry entry;
  final StructIconAnnotation annotation;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => entry.destination()),
        ),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  StructIcon(kind: entry.iconKind, color: entry.iconColor, size: 22, annotation: annotation),
                  const SizedBox(height: 10),
                  Text(
                    entry.label,
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              if (entry.badge != null)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.accentBlue.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      entry.badge!,
                      style: const TextStyle(fontSize: 9.5, color: AppColors.accentBlue, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
