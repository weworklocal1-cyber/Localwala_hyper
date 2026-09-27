import 'package:flutter/material.dart';

import '../../core/strings/app_strings.dart';
import '../../core/widgets/shells.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderScreen(
      title: 'Go online',
      emptyMessage: AppStrings.homeEmpty,
    );
  }
}
