import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/networking/api_client.dart';
import '../../core/strings/app_strings.dart';
import '../../core/widgets/otp_input.dart';
import 'auth_providers.dart';

/// Phone entry: normalizes to E.164, requests an OTP, then routes to the
/// code screen (spec §7 OTP request; §520 customer OTP verification).
class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final TextEditingController _phoneController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final String? phone = normalizePhone(_phoneController.text);
    if (phone == null) {
      setState(() {
        _error = AppStrings.phoneInvalid;
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(otpAuthRepositoryProvider).requestOtp(phone);
      if (!mounted) {
        return;
      }
      setState(() => _submitting = false);
      context.push('/auth/otp?phone=${Uri.encodeComponent(phone)}');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _submitting = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(AppStrings.loginTitle)),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                TextField(
                  key: const ValueKey<String>('phone-field'),
                  controller: _phoneController,
                  enabled: !_submitting,
                  keyboardType: TextInputType.phone,
                  autofillHints: const <String>[AutofillHints.telephoneNumber],
                  decoration: InputDecoration(
                    labelText: AppStrings.phoneLabel,
                    hintText: AppStrings.phoneHint,
                    prefixText: '+91 ',
                    errorText: _error,
                  ),
                  onSubmitted: (_) => _sendCode(),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  key: const ValueKey<String>('send-code-button'),
                  onPressed: _submitting ? null : _sendCode,
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(AppStrings.sendCode),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
