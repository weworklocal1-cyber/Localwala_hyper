import 'package:flutter/material.dart';

import '../../core/strings/app_strings.dart';
import '../../core/widgets/shells.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderScreen(
      title: 'Profile',
      emptyMessage: AppStrings.profileEmpty,
    );
  }
}
