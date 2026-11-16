import "package:flutter/material.dart";

import "../../state/app_scope.dart";
import "../account/account_screen.dart";
import "../dashboard/dashboard_screen.dart";
import "../settings/settings_screen.dart";

/// The 3-tab shell (spec §2): Calculs (main), Paramètres, and Mon compte —
/// the last only shown once the user is logged in.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final showAccountTab = app.isLoggedIn;

    final tabs = <_Tab>[
      const _Tab(label: "Calculs", icon: Icons.calculate_outlined, page: DashboardScreen()),
      const _Tab(label: "Paramètres", icon: Icons.tune_outlined, page: SettingsScreen()),
      if (showAccountTab)
        const _Tab(label: "Mon compte", icon: Icons.person_outline, page: AccountScreen()),
    ];

    final index = _index.clamp(0, tabs.length - 1).toInt();

    return Scaffold(
      body: IndexedStack(
        index: index,
        children: [for (final t in tabs) t.page],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: index,
        onTap: (i) => setState(() => _index = i),
        items: [
          for (final t in tabs)
            BottomNavigationBarItem(icon: Icon(t.icon), label: t.label),
        ],
      ),
    );
  }
}

class _Tab {
  const _Tab({required this.label, required this.icon, required this.page});

  final String label;
  final IconData icon;
  final Widget page;
}
