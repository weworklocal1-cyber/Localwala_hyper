import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Native one-time-code input (spec §1146 native-feeling OTP interactions):
/// digit boxes backed by a single hidden field so autofill
/// (`AutofillHints.oneTimeCode`), paste and system keyboards work like a
/// platform-built code form. Copy is supplied by the caller.
class OtpInput extends StatefulWidget {
  const OtpInput({
    super.key,
    required this.onCompleted,
    this.length = 6,
    this.enabled = true,
    this.autofocus = true,
    this.controller,
  });

  /// Called with the full code once [length] digits are entered.
  final ValueChanged<String> onCompleted;

  final int length;
  final bool enabled;
  final bool autofocus;

  /// Optional external controller (screen-owned) so failed submissions can
  /// clear the input.
  final TextEditingController? controller;

  @override
  State<OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends State<OtpInput> {
  late final TextEditingController _controller =
      widget.controller ?? TextEditingController();
  late final FocusNode _focusNode = FocusNode();
  String _lastNotified = '';

  @override
  void initState() {
    super.initState();
    // Boxes mirror the hidden field, whether updated by typing or cleared
    // programmatically by the screen.
    _controller.addListener(_handleControllerChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_handleControllerChanged);
    if (widget.controller == null) {
      _controller.dispose();
    }
    _focusNode.dispose();
    super.dispose();
  }

  void _handleControllerChanged() => setState(() {});

  void _handleChanged(String value) {
    if (value.length == widget.length && value != _lastNotified) {
      _lastNotified = value;
      widget.onCompleted(value);
    } else if (value.length < widget.length) {
      _lastNotified = '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String value = _controller.text;
    return Stack(
      children: <Widget>[
        // Digit boxes — pure presentation over the hidden field.
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            for (int index = 0; index < widget.length; index++)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Container(
                  key: ValueKey<String>('otp-box-$index'),
                  width: 44,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: index < value.length
                          ? theme.colorScheme.primary
                          : theme.colorScheme.outline,
                      width: index < value.length ? 2 : 1,
                    ),
                    borderRadius: BorderRadius.circular(8),
                    color: index < value.length
                        ? theme.colorScheme.primaryContainer
                        : null,
                  ),
                  child: Text(
                    index < value.length ? value[index] : '',
                    style: theme.textTheme.titleLarge,
                  ),
                ),
              ),
          ],
        ),
        // Hidden input: keeps native keyboard, paste and one-time-code
        // autofill while the boxes render the visible state.
        Positioned.fill(
          child: Opacity(
            opacity: 0,
            child: TextField(
              key: const ValueKey<String>('otp-field'),
              controller: _controller,
              focusNode: _focusNode,
              enabled: widget.enabled,
              autofocus: widget.autofocus,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              autofillHints: const <String>[AutofillHints.oneTimeCode],
              maxLength: widget.length,
              inputFormatters: <TextInputFormatter>[
                FilteringTextInputFormatter.digitsOnly,
              ],
              decoration: const InputDecoration(
                counterText: '',
                border: InputBorder.none,
              ),
              onChanged: _handleChanged,
            ),
          ),
        ),
      ],
    );
  }
}

/// True when [raw] is a valid E.164 phone (auth-service contract).
bool isValidE164Phone(String raw) => RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(raw);

/// Normalizes user input to E.164: strips spaces/dashes/parentheses; values
/// already starting with `+` are kept as-is, otherwise the Indian country
/// code is assumed (LocalWala is India-first, spec §12).
String? normalizePhone(String raw) {
  final String cleaned = raw.replaceAll(RegExp(r'[\s\-()]'), '');
  if (cleaned.isEmpty) {
    return null;
  }
  String candidate = cleaned;
  if (!candidate.startsWith('+')) {
    var digits = candidate;
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    if (digits.startsWith('91') && digits.length == 12) {
      candidate = '+$digits';
    } else {
      candidate = '+91$digits';
    }
  }
  return isValidE164Phone(candidate) ? candidate : null;
}
