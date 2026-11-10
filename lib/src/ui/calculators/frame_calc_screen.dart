import "package:flutter/material.dart";

import "workspace/calculator_model.dart";
import "workspace/calculator_page.dart";

class FrameCalcScreen extends StatelessWidget {
  const FrameCalcScreen({super.key});

  @override
  Widget build(BuildContext context) => const CalculatorPage(kind: CalculatorKind.frame);
}
