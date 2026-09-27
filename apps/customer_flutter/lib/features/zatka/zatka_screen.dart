import 'package:flutter/material.dart';

import '../../core/strings/app_strings.dart';
import '../../core/widgets/shells.dart';

class ZatkaScreen extends StatelessWidget {
  const ZatkaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderScreen(
      title: 'Zatka',
      emptyMessage: AppStrings.zatkaEmpty,
    );
  }
}
