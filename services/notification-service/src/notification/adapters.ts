import { AppError } from '@localwala/errors';
import type { NotificationRepository } from './notification.repository.js';
import { newInAppId, type OutgoingMessage } from './notification.types.js';

export interface AdapterResult {
  providerRef?: string;
  notificationId?: string;
}

export interface ChannelAdapter {
  send(message: OutgoingMessage): Promise<AdapterResult>;
}

/**
 * STAGING ONLY — external provider not selected yet.
 * Throws SERVICE_UNAVAILABLE (503) (specification section 1).
 */
export class StagingExternalAdapter implements ChannelAdapter {
  constructor(private readonly channel: string) {}

  async send(): Promise<AdapterResult> {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `${this.channel} channel adapter not configured — notification provider integration pending.`,
      retryable: false,
    });
  }
}

export class InAppChannelAdapter implements ChannelAdapter {
  constructor(private readonly repo: NotificationRepository) {}

  async send(message: OutgoingMessage): Promise<AdapterResult> {
    const notification = {
      id: newInAppId(),
      userId: message.userId,
      title: message.title ?? message.body,
      ...(message.body !== '' ? { body: message.body } : {}),
      ...(message.deepLink !== undefined ? { deepLink: message.deepLink } : {}),
      read: false,
      createdAt: Date.now(),
    };
    await this.repo.saveInApp(notification);
    return { notificationId: notification.id };
  }
}

export function buildAdapters(
  repo: NotificationRepository,
  stagingChannels: readonly string[],
): Record<string, ChannelAdapter> {
  const adapters: Record<string, ChannelAdapter> = {
    in_app: new InAppChannelAdapter(repo),
  };
  for (const channel of stagingChannels) {
    adapters[channel] = new StagingExternalAdapter(channel);
  }
  return adapters;
}
