import "package:flutter/material.dart";

import "../domain/domain.dart";
import "../theme/app_colors.dart";
import "number_field.dart";

/// One editable revêtement row (name + charge surfacique + remove) — used
/// by both the poteau/voile level editor and the réseau de poutres panel
/// editor (spec §4/§6: "revêtements illimités, chacun avec nom libre +
/// charge surfacique").
class CoatingRow extends StatefulWidget {
  const CoatingRow({super.key, required this.coating, required this.onChanged, required this.onRemove});

  final Coating coating;
  final ValueChanged<Coating> onChanged;
  final VoidCallback onRemove;

  @override
  State<CoatingRow> createState() => _CoatingRowState();
}

class _CoatingRowState extends State<CoatingRow> {
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
