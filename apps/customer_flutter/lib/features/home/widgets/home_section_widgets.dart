import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

import '../../../core/strings/app_strings.dart';
import '../config/home_feed_config.dart';

/// Native banner for the remote-config `banner` component: a tappable image
/// card with an offline/error fallback — no remote markup, only Flutter
/// widgets (spec §11).
class BannerSection extends StatelessWidget {
  const BannerSection({super.key, required this.banner, this.onNavigate});

  final BannerConfig banner;
  final void Function(String target)? onNavigate;

  @override
  Widget build(BuildContext context) {
    if (!banner.visible) {
      return const SizedBox.shrink();
    }
    final void Function(String target)? navigate = onNavigate;
    return Semantics(
      container: true,
      image: true,
      label: AppStrings.bannerLabel,
      child: InkWell(
        key: const ValueKey<String>('home-banner'),
        onTap: navigate == null ? null : () => navigate(banner.target),
        child: SizedBox(
          height: 160,
          width: double.infinity,
          child: Image.network(
            banner.imageUrl,
            fit: BoxFit.cover,
            errorBuilder:
                (BuildContext context, Object error, StackTrace? stack) =>
                    ColoredBox(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      child: Center(
                        child: Icon(
                          Icons.image_outlined,
                          size: 40,
                          color: Theme.of(
                            context,
                          ).colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ),
          ),
        ),
      ),
    );
  }
}

/// Maps the remote-config `fit` value onto a [BoxFit] (unknown values fall
/// back to [BoxFit.contain] — config data is never trusted blindly).
BoxFit lottieBoxFit(String? fit) {
  return switch (fit) {
    'cover' => BoxFit.cover,
    'fill' => BoxFit.fill,
    _ => BoxFit.contain,
  };
}

/// Scales a composition duration by the configured playback speed
/// (speed 2.0 → half duration → twice as fast).
Duration lottieDurationForSpeed(Duration base, double speed) {
  if (speed <= 0) {
    return base;
  }
  return Duration(microseconds: (base.inMicroseconds / speed).round());
}

/// Remote-config driven Lottie header (spec §12 dynamic Lottie header,
/// §11 Lottie URL/fit/speed/loop/visibility): a native player honoring the
/// published animation settings, with an offline/error fallback.
class LottieHeader extends StatefulWidget {
  const LottieHeader({super.key, required this.lottie});

  final LottieConfig lottie;

  @override
  State<LottieHeader> createState() => _LottieHeaderState();
}

class _LottieHeaderState extends State<LottieHeader>
    with SingleTickerProviderStateMixin {
  /// Created only when a playback speed other than 1.0 is configured —
  /// never during dispose (that would look up a deactivated ancestor).
  AnimationController? _speedController;

  @override
  void dispose() {
    _speedController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final LottieConfig config = widget.lottie;
    if (!config.visible) {
      return const SizedBox.shrink();
    }
    final double speed = config.speed ?? 1.0;
    if (speed != 1.0) {
      _speedController ??= AnimationController(vsync: this);
    }
    final AnimationController? speedController = speed != 1.0
        ? _speedController
        : null;
    return Semantics(
      container: true,
      image: true,
      label: AppStrings.homeHeaderLabel,
      child: SizedBox(
        key: const ValueKey<String>('home-lottie-header'),
        height: 160,
        width: double.infinity,
        child: Lottie.network(
          config.url,
          fit: lottieBoxFit(config.fit),
          repeat: config.loop ?? true,
          controller: speedController,
          onLoaded: (LottieComposition composition) {
            if (speedController != null) {
              speedController.duration = lottieDurationForSpeed(
                composition.duration,
                speed,
              );
              speedController.repeat();
            }
          },
          errorBuilder:
              (BuildContext context, Object error, StackTrace? stackTrace) =>
                  ColoredBox(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    child: Center(
                      child: Icon(
                        Icons.animation_outlined,
                        size: 40,
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                      ),
                    ),
                  ),
        ),
      ),
    );
  }
}
