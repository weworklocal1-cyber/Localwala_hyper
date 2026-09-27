import 'package:flutter/material.dart';

import '../../core/strings/app_strings.dart';
import '../../core/widgets/shells.dart';

class AuthScreen extends StatelessWidget {
  const AuthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholderScreen(
      title: 'Sign in',
      emptyMessage: AppStrings.loginEmpty,
    );
  }
}
