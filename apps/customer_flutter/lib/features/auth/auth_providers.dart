import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app.dart';
import 'otp_auth_repository.dart';

/// Phone + OTP auth wiring (OC-0037).
final Provider<OtpAuthRepository> otpAuthRepositoryProvider =
    Provider<OtpAuthRepository>(
      (Ref ref) => ApiOtpAuthRepository(
        ref.watch(apiClientProvider),
        ref.watch(sessionStoreProvider),
      ),
    );
