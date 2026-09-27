import 'package:flutter/material.dart';

import '../../core/strings/app_strings.dart';
import '../../core/widgets/shells.dart';

class DocumentsScreen extends StatelessWidget {
  const DocumentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderScreen(
      title: 'Documents',
      emptyMessage: AppStrings.documentsEmpty,
    );
  }
}
