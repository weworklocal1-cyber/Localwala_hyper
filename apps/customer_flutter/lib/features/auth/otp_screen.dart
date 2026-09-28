import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/networking/api_client.dart';
import '../../core/strings/app_strings.dart';
import '../../core/widgets/otp_input.dart';
import 'auth_providers.dart';
import 'otp_auth_repository.dart';

/// Resend cooldown — client-side pacing; the service rate-limits
/// independently (spec §7 OTP abuse prevention).
const int otpResendCooldownSeconds = 60;

/// Code entry: one-time-code boxes, resend countdown, verify → login →
/// tokens persisted (spec §7, §520).
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final TextEditingController _codeController = TextEditingController();
  Timer? _countdown;
  int _remaining = otpResendCooldownSeconds;
  bool _submitting = false;
  bool _resending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _countdown?.cancel();
    _codeController.dispose();
    super.dispose();
  }

  void _startCountdown() {
    _remaining = otpResendCooldownSeconds;
    _countdown?.cancel();
    _countdown = Timer.periodic(const Duration(seconds: 1), (Timer timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_remaining > 0) {
          _remaining -= 1;
        }
        if (_remaining == 0) {
          timer.cancel();
        }
      });
    });
  }

  Future<void> _submit(String code) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final OtpAuthRepository repository = ref.read(otpAuthRepositoryProvider);
      await repository.verifyOtp(widget.phone, code);
      await repository.login(widget.phone, code);
      if (!mounted) {
        return;
      }
      context.go('/');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _error = error.message;
        _codeController.clear();
      });
    }
  }

  Future<void> _resend() async {
    if (_remaining > 0 || _resending) {
      return;
    }
    setState(() {
      _resending = true;
      _error = null;
    });
    try {
      await ref.read(otpAuthRepositoryProvider).resendOtp(widget.phone);
      if (!mounted) {
        return;
      }
      setState(() {
        _resending = false;
        _codeController.clear();
      });
      _startCountdown();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text(AppStrings.otpResent)));
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _resending = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.otpTitle)),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  '${AppStrings.otpSentTo} ${widget.phone}',
                  key: const ValueKey<String>('otp-sent-to'),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                OtpInput(
                  controller: _codeController,
                  enabled: !_submitting,
                  onCompleted: _submit,
                ),
                if (_error != null) ...<Widget>[
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    key: const ValueKey<String>('otp-error'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  key: const ValueKey<String>('verify-button'),
                  onPressed: _submitting
                      ? null
                      : () => _submit(_codeController.text),
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(AppStrings.verifyContinue),
                ),
                const SizedBox(height: 12),
                TextButton(
                  key: const ValueKey<String>('resend-button'),
                  onPressed: (_remaining > 0 || _resending || _submitting)
                      ? null
                      : _resend,
                  child: Text(
                    _remaining > 0
                        ? AppStrings.resendInWith(_remaining)
                        : AppStrings.resendCode,
                  ),
                ),
                TextButton(
                  key: const ValueKey<String>('change-number'),
                  onPressed: _submitting ? null : () => context.pop(),
                  child: const Text(AppStrings.changeNumber),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
