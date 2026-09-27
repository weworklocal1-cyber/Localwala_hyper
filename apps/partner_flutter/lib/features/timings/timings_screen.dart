import 'package:flutter/material.dart';

import '../../core/strings/app_strings.dart';
import '../../core/widgets/shells.dart';

class TimingsScreen extends StatelessWidget {
  const TimingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderScreen(
      title: 'Timings',
      emptyMessage: AppStrings.timingsEmpty,
    );
  }
}
