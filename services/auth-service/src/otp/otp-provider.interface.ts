export interface OtpProvider {
  readonly name: string;
  send(phoneE164: string, code: string): Promise<void>;
}

export interface OtpProviderConfig {
  provider: OtpProvider;
  codeLength?: number;
  ttlSeconds?: number;
  maxAttempts?: number;
  rateLimitWindowSeconds?: number;
  rateLimitMaxRequests?: number;
}
