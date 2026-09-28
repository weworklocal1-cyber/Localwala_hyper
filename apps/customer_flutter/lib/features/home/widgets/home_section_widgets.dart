import 'package:flutter/material.dart';

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

/// Placeholder slot for the remote-config `lottie_header` component —
/// renders a native container today; OC-0036 wires the real Lottie player
/// into this slot.
class LottieHeaderSlot extends StatelessWidget {
  const LottieHeaderSlot({super.key, required this.lottie});

  final LottieConfig lottie;

  @override
  Widget build(BuildContext context) {
    if (!lottie.visible) {
      return const SizedBox.shrink();
    }
    return SizedBox(
      key: const ValueKey<String>('home-lottie-slot'),
      height: 120,
      width: double.infinity,
      child: ColoredBox(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: Center(
          child: Icon(
            Icons.animation_outlined,
            size: 40,
            color: Theme.of(context).colorScheme.outline,
          ),
        ),
      ),
    );
  }
}
