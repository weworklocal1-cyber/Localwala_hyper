import 'package:flutter/material.dart';

import '../../core/strings/app_strings.dart';
import '../../core/widgets/shells.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderScreen(
      title: 'Support',
      emptyMessage: AppStrings.supportEmpty,
    );
  }
}
