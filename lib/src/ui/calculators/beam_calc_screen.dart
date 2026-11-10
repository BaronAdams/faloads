import "package:flutter/material.dart";

import "workspace/calculator_model.dart";
import "workspace/calculator_page.dart";

class BeamCalcScreen extends StatelessWidget {
  const BeamCalcScreen({super.key});

  @override
  Widget build(BuildContext context) => const CalculatorPage(kind: CalculatorKind.beam);
}
