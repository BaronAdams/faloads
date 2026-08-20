import "package:flutter/material.dart";

import "../../state/app_scope.dart";
import "../../theme/app_colors.dart";
import "../../widgets/empty_state.dart";
import "../beam_network/beam_network_flow_screen.dart";
import "../placeholder/coming_soon_screen.dart";
import "../poteau/poteau_flow_screen.dart";
import "../predim/predim_screen.dart";
import "../voile/voile_flow_screen.dart";

class _CalcEntry {
  const _CalcEntry({
    required this.icon,
    required this.label,
    required this.destination,
    this.badge,
  });

  final IconData icon;
  final String label;
  final String? badge;
  final Widget Function() destination;
}

Widget _comingSoon(String label) => ComingSoonScreen(
      title: label,
      subtitle: "Le calcul « $label » arrive dans une prochaine phase du portage.",
    );

/// Dashboard / "Calculs" home (spec §2): two calculation families —
/// Prédimensionnement (6 element types) and Descente de charges (poteau /
/// voile / réseau de poutres / bâtiment complet) — plus a recent-projects
/// list that starts empty.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  static final List<_CalcEntry> _predim = [
    _CalcEntry(
      icon: Icons.view_column_outlined,
      label: "Poteau",
      destination: () => const PredimScreen(initialType: PredimElementType.poteau),
    ),
    _CalcEntry(
      icon: Icons.horizontal_rule,
      label: "Poutre",
      destination: () => const PredimScreen(initialType: PredimElementType.poutre),
    ),
    _CalcEntry(
      icon: Icons.view_agenda_outlined,
      label: "Voile",
      destination: () => const PredimScreen(initialType: PredimElementType.voile),
    ),
    _CalcEntry(
      icon: Icons.grid_on_outlined,
      label: "Plancher",
      destination: () => const PredimScreen(initialType: PredimElementType.plancher),
    ),
    _CalcEntry(
      icon: Icons.exit_to_app_outlined,
      label: "Balcon",
      destination: () => const PredimScreen(initialType: PredimElementType.balcon),
    ),
    _CalcEntry(
      icon: Icons.stairs_outlined,
      label: "Escalier",
      destination: () => const PredimScreen(initialType: PredimElementType.escalier),
    ),
  ];

  static final List<_CalcEntry> _descente = [
    _CalcEntry(icon: Icons.view_column_outlined, label: "Poteau isolé", destination: () => const PoteauFlowScreen()),
    _CalcEntry(icon: Icons.view_agenda_outlined, label: "Voile isolé", destination: () => const VoileFlowScreen()),
    _CalcEntry(
      icon: Icons.grid_view_outlined,
      label: "Réseau de poutres",
      destination: () => const BeamNetworkFlowScreen(),
    ),
    _CalcEntry(
      icon: Icons.apartment_outlined,
      label: "Bâtiment complet",
      badge: "Pro",
      destination: () => _comingSoon("Bâtiment complet"),
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
          _CalcGrid(entries: _predim, crossAxisCount: 3),
          const SizedBox(height: 24),
          const _SectionTitle(
            title: "Descente de charges",
            subtitle: "Cheminement complet des charges jusqu'aux fondations",
          ),
          const SizedBox(height: 10),
          _CalcGrid(entries: _descente, crossAxisCount: 2),
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
                      for (final p in app.recentProjects) ListTile(title: Text(p)),
                    ],
                  ),
          ),
        ],
      ),
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
  const _CalcGrid({required this.entries, required this.crossAxisCount});

  final List<_CalcEntry> entries;
  final int crossAxisCount;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: entries.length,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: crossAxisCount == 3 ? 0.95 : 1.7,
      ),
      itemBuilder: (context, i) => _CalcCard(entry: entries[i]),
    );
  }
}

class _CalcCard extends StatelessWidget {
  const _CalcCard({required this.entry});

  final _CalcEntry entry;

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
                  Icon(entry.icon, color: AppColors.accentBlue, size: 22),
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
