import "package:flutter/material.dart";

import "../../state/app_scope.dart";
import "../../theme/app_colors.dart";

/// Paramètres tab (spec §2): units, default règlement, language, theme,
/// account shortcut. Kept as real, working toggles even though most just
/// hold local state in this phase — no calculation logic depends on them yet.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _units = "SI (m, kN)";
  String _reglement = "Eurocode 2";
  String _langue = "Français";

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text("Paramètres")),
      body: ListView(
        children: [
          const _GroupLabel("Calcul"),
          _SettingsTile(
            label: "Unités",
            value: _units,
            onTap: () => _pick(
              context,
              title: "Unités",
              options: const ["SI (m, kN)", "Impérial (ft, kip)"],
              current: _units,
              onSelected: (v) => setState(() => _units = v),
            ),
          ),
          _SettingsTile(
            label: "Règlement par défaut",
            value: _reglement,
            onTap: () => _pick(
              context,
              title: "Règlement par défaut",
              options: const ["Eurocode 2", "BAEL 91"],
              current: _reglement,
              onSelected: (v) => setState(() => _reglement = v),
            ),
          ),
          const Divider(height: 32),
          const _GroupLabel("Application"),
          _SettingsTile(
            label: "Langue",
            value: _langue,
            onTap: () => _pick(
              context,
              title: "Langue",
              options: const ["Français", "English"],
              current: _langue,
              onSelected: (v) => setState(() => _langue = v),
            ),
          ),
          const _SettingsTile(label: "Thème", value: "Sombre"),
          const Divider(height: 32),
          const _GroupLabel("Compte"),
          if (app.isLoggedIn)
            ListTile(
              leading: const Icon(Icons.logout, color: AppColors.danger),
              title: const Text("Se déconnecter", style: TextStyle(color: AppColors.danger)),
              onTap: app.logOut,
            )
          else
            ListTile(
              leading: const Icon(Icons.login, color: AppColors.accentBlue),
              title: const Text("Se connecter", style: TextStyle(color: AppColors.accentBlue)),
              onTap: app.logIn,
            ),
        ],
      ),
    );
  }

  void _pick(
    BuildContext context, {
    required String title,
    required List<String> options,
    required String current,
    required ValueChanged<String> onSelected,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
            for (final o in options)
              ListTile(
                title: Text(o),
                trailing: o == current ? const Icon(Icons.check, color: AppColors.accentBlue) : null,
                onTap: () {
                  onSelected(o);
                  Navigator.of(context).pop();
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.4,
          color: AppColors.textTertiary,
        ),
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({required this.label, required this.value, this.onTap});

  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(label),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(value, style: const TextStyle(color: AppColors.textSecondary)),
          if (onTap != null) ...[
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, color: AppColors.textTertiary),
          ],
        ],
      ),
      onTap: onTap,
    );
  }
}
