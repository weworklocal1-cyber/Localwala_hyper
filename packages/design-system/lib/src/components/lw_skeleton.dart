import 'package:flutter/material.dart';

import '../tokens/lw_colors.dart';
import '../tokens/lw_motion.dart';
import '../tokens/lw_radii.dart';
import '../tokens/lw_spacing.dart';

/// Skeleton loading placeholder (spec §32: skeleton components).
///
/// A subtle pulse animation stands in for content while data loads.
class LwSkeleton extends StatefulWidget {
  const LwSkeleton({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.radius = LwRadii.xs,
  });

  final double width;
  final double height;
  final double radius;

  @override
  State<LwSkeleton> createState() => _LwSkeletonState();
}

class _LwSkeletonState extends State<LwSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: LwMotion.skeletonPeriod,
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Loading',
      image: true,
      child: FadeTransition(
        opacity: Tween<double>(begin: 0.4, end: 1.0).animate(
          CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
        ),
        child: Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: LwColors.skeletonBase,
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        ),
      ),
    );
  }
}

/// A stack of skeleton lines for content placeholders; the last line is
/// rendered at [lastLineWidth] of the available width.
class LwSkeletonLines extends StatelessWidget {
  const LwSkeletonLines({
    super.key,
    this.lines = 3,
    this.lastLineWidth = 0.6,
  });

  final int lines;
  final double lastLineWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double available = constraints.maxWidth;
        final bool bounded = available.isFinite;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            for (int index = 0; index < lines; index += 1)
              Padding(
                padding: const EdgeInsets.only(bottom: LwSpacing.sm),
                child: LwSkeleton(
                  width: !bounded
                      ? double.infinity
                      : index == lines - 1
                          ? available * lastLineWidth
                          : available,
                  height: index == 0 ? 20 : 14,
                ),
              ),
          ],
        );
      },
    );
  }
}
