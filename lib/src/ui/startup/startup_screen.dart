import 'package:flutter/material.dart';

class StartupScreen extends StatelessWidget {
  const StartupScreen({super.key, this.error = false, this.onRetry, this.onContinue});

  final bool error;
  final VoidCallback? onRetry;
  final VoidCallback? onContinue;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(error ? Icons.folder_off_outlined : Icons.architecture, size: 40),
                    const SizedBox(height: 20),
                    Text(error ? 'Ouverture interrompue' : 'Ouverture de StructCalc',
                        textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 16),
                    if (!error) ...[
                      const CircularProgressIndicator(),
                      const SizedBox(height: 16),
                      const Text('Chargement de vos données locales…', textAlign: TextAlign.center),
                    ] else ...[
                      const Text(
                        'Les données locales n’ont pas pu être chargées. Réessayez ou ouvrez une session temporaire '
                        'sans sauvegarde. Vos données existantes ne seront pas effacées.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      FilledButton.icon(
                        onPressed: onRetry,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Réessayer'),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: onContinue,
                        child: const Text('Continuer sans sauvegarde'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}
