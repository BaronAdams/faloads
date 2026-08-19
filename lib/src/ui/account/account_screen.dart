import "package:flutter/material.dart";

import "../../state/app_scope.dart";
import "../../theme/app_colors.dart";
import "../../widgets/empty_state.dart";
import "../onboarding/paywall_screen.dart";

/// Mon compte tab — only reachable while logged in (spec §2): subscription
/// status, saved projects, sign-out.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text("Mon compte")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceRaised,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.person_outline, color: AppColors.accentBlue),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        app.isSubscribed ? "Formule Pro" : "Formule Gratuite",
                        style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        app.isSubscribed ? "Essai gratuit en cours" : "Fonctionnalités limitées",
                        style: const TextStyle(fontSize: 12, color: AppColors.textTertiary),
                      ),
                    ],
                  ),
                ),
                if (!app.isSubscribed)
                  TextButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const PaywallScreen()),
                    ),
                    child: const Text("Passer Pro"),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            "PROJETS",
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.4, color: AppColors.textTertiary),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: app.recentProjects.isEmpty
                ? const EmptyState(
                    icon: Icons.folder_open_outlined,
                    title: "Aucun projet enregistré",
                    message: "Vos calculs sauvegardés apparaîtront ici.",
                  )
                : Column(
                    children: [for (final p in app.recentProjects) ListTile(title: Text(p))],
                  ),
          ),
          const SizedBox(height: 20),
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.danger),
            title: const Text("Se déconnecter", style: TextStyle(color: AppColors.danger)),
            onTap: app.logOut,
          ),
        ],
      ),
    );
  }
}
