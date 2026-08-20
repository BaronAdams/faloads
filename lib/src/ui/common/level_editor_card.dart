import "package:flutter/material.dart";

import "../../domain/domain.dart";
import "../../theme/app_colors.dart";
import "../../theme/app_theme.dart";
import "../../widgets/number_field.dart";
import "../../widgets/picker_field.dart";
import "level_form_state.dart";

/// One collapsible level card in the "Niveaux" step (spec §4-5): storey
/// height, a caller-supplied section editor (b×h for a poteau, épaisseur
/// for a voile — the one thing that differs between the two flows), slab
/// type + usage pickers, and an unlimited coatings list.
class LevelEditorCard extends StatefulWidget {
  const LevelEditorCard({
    super.key,
    required this.level,
    required this.sectionEditor,
    required this.onChanged,
    required this.onRemove,
    this.initiallyExpanded = false,
  });

  final LevelFormState level;
  final Widget sectionEditor;
  final VoidCallback onChanged;
  final VoidCallback onRemove;
  final bool initiallyExpanded;

  @override
  State<LevelEditorCard> createState() => _LevelEditorCardState();
}

class _LevelEditorCardState extends State<LevelEditorCard> {
  late bool _expanded = widget.initiallyExpanded;
  late final _labelController = TextEditingController(text: widget.level.label);

  @override
  void dispose() {
    _labelController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final level = widget.level;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      level.label,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                  ),
                  Text(
                    "h = ${level.heightM.toStringAsFixed(2)} m",
                    style: AppTheme.monoTextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    color: AppColors.textTertiary,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _labelController,
                    style: const TextStyle(fontSize: 14),
                    decoration: const InputDecoration(isDense: true, labelText: "Nom du niveau"),
                    onChanged: (v) {
                      level.label = v;
                      widget.onChanged();
                    },
                  ),
                  const SizedBox(height: 14),
                  NumberField(
                    label: "Hauteur d'étage",
                    unit: "m",
                    value: level.heightM,
                    min: 0.1,
                    onChanged: (v) {
                      setState(() => level.heightM = v);
                      widget.onChanged();
                    },
                  ),
                  const SizedBox(height: 14),
                  widget.sectionEditor,
                  const SizedBox(height: 14),
                  PickerField(
                    label: "Type de dalle",
                    value: level.slabTypeId,
                    options: slabTypes.map((s) => s.id).toList(),
                    optionLabel: (id) => slabTypes.firstWhere((s) => s.id == id).label,
                    onChanged: (v) {
                      setState(() => level.slabTypeId = v);
                      widget.onChanged();
                    },
                  ),
                  if (level.slabType.isDallePleine) ...[
                    const SizedBox(height: 14),
                    NumberField(
                      label: "Épaisseur de la dalle",
                      unit: "m",
                      value: level.slabThicknessM,
                      min: 0.05,
                      onChanged: (v) {
                        setState(() => level.slabThicknessM = v);
                        widget.onChanged();
                      },
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    "pp = ${level.gDalleKnM2.toStringAsFixed(2)} kN/m²",
                    style: AppTheme.monoTextStyle(fontSize: 11, color: AppColors.accentAmber),
                  ),
                  const SizedBox(height: 14),
                  PickerField(
                    label: "Usage (EC1)",
                    value: level.usageId,
                    options: usageCategories.map((u) => u.id).toList(),
                    optionLabel: (id) {
                      final u = usageCategories.firstWhere((u) => u.id == id);
                      return "${u.id} — ${u.label}";
                    },
                    onChanged: (v) {
                      setState(() => level.usageId = v);
                      widget.onChanged();
                    },
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "Q = ${level.qKnM2.toStringAsFixed(2)} kN/m²",
                    style: AppTheme.monoTextStyle(fontSize: 11, color: AppColors.accentBlue),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      const Text(
                        "Revêtements",
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                      ),
                      const Spacer(),
                      Text(
                        "Σ = ${level.gRevKnM2.toStringAsFixed(2)} kN/m²",
                        style: AppTheme.monoTextStyle(fontSize: 11, color: AppColors.textTertiary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  for (final slot in level.coatings)
                    _CoatingRow(
                      key: ValueKey(slot.id),
                      coating: slot.coating,
                      onChanged: (c) {
                        setState(() => slot.coating = c);
                        widget.onChanged();
                      },
                      onRemove: () {
                        setState(() => level.coatings.remove(slot));
                        widget.onChanged();
                      },
                    ),
                  const SizedBox(height: 4),
                  OutlinedButton.icon(
                    onPressed: () {
                      setState(() => level.coatings.add(CoatingSlot(const Coating(name: "Revêtement", loadKnM2: 0.2))));
                      widget.onChanged();
                    },
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text("Ajouter un revêtement"),
                  ),
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: widget.onRemove,
                      icon: const Icon(Icons.delete_outline, size: 16, color: AppColors.danger),
                      label: const Text("Supprimer ce niveau", style: TextStyle(color: AppColors.danger)),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _CoatingRow extends StatefulWidget {
  const _CoatingRow({required this.coating, required this.onChanged, required this.onRemove});

  final Coating coating;
  final ValueChanged<Coating> onChanged;
  final VoidCallback onRemove;

  @override
  State<_CoatingRow> createState() => _CoatingRowState();
}

class _CoatingRowState extends State<_CoatingRow> {
  late final _nameController = TextEditingController(text: widget.coating.name);

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: TextFormField(
              controller: _nameController,
              style: const TextStyle(fontSize: 13),
              decoration: const InputDecoration(isDense: true, hintText: "Nom"),
              onChanged: (v) => widget.onChanged(Coating(name: v, loadKnM2: widget.coating.loadKnM2)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: NumberField(
              label: "",
              unit: "kN/m²",
              value: widget.coating.loadKnM2,
              onChanged: (v) => widget.onChanged(Coating(name: widget.coating.name, loadKnM2: v)),
            ),
          ),
          IconButton(
            onPressed: widget.onRemove,
            icon: const Icon(Icons.close, size: 16, color: AppColors.textTertiary),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          ),
        ],
      ),
    );
  }
}
