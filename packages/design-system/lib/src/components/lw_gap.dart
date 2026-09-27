import 'package:flutter/material.dart';

/// Spacing helpers built on the 4px grid (spec §32: spacing system).
class LwGap extends StatelessWidget {
  const LwGap(this.size, {super.key});

  const LwGap.xs({super.key}) : size = 4;
  const LwGap.sm({super.key}) : size = 8;
  const LwGap.md({super.key}) : size = 16;
  const LwGap.lg({super.key}) : size = 24;
  const LwGap.xl({super.key}) : size = 32;

  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(width: size, height: size);
}
