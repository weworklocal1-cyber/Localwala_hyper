import { AppError } from '@localwala/errors';
import type { ChannelAdapter } from './adapters.js';
import type { NotificationRepository } from './notification.repository.js';
import {
  CHANNELS,
  newTemplateId,
  renderTemplate,
  type Channel,
  type InAppNotification,
  type NotificationPreference,
  type NotificationTemplate,
  type SendResult,
} from './notification.types.js';
import {
  parseCreateInApp,
  parseCreateTemplate,
  parseListInApp,
  parseListTemplates,
  parseSend,
  parseSetPreference,
  parseUpdateTemplate,
} from '../schemas/notification.schema.js';

export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly adapters: Record<string, ChannelAdapter>,
  ) {}

  async createTemplate(input: unknown): Promise<NotificationTemplate> {
    const parsed = parseCreateTemplate(input);
    const existing = await this.repo.findTemplateByKey(parsed.key, parsed.channel);
    if (existing) {
      throw new AppError('CONFLICT', {
        message: 'A template with this key and channel already exists.',
        details: { key: parsed.key, channel: parsed.channel },
      });
    }
    const now = Date.now();
    const template: NotificationTemplate = {
      id: newTemplateId(),
      key: parsed.key,
      channel: parsed.channel,
      body: parsed.body,
      locale: parsed.locale ?? 'en',
      createdAt: now,
      updatedAt: now,
    };
    if (parsed.title !== undefined) template.title = parsed.title;
    await this.repo.saveTemplate(template);
    return template;
  }

  async updateTemplate(templateId: string, input: unknown): Promise<NotificationTemplate> {
    const parsed = parseUpdateTemplate(input);
    const template = await this.requireTemplate(templateId);
    if (parsed.body !== undefined) template.body = parsed.body;
    if (parsed.title !== undefined) {
      if (parsed.title === null) delete template.title;
      else template.title = parsed.title;
    }
    if (parsed.locale !== undefined) template.locale = parsed.locale;
    template.updatedAt = Date.now();
    await this.repo.saveTemplate(template);
    return template;
  }

  async getTemplate(templateId: string): Promise<NotificationTemplate> {
    return this.requireTemplate(templateId);
  }

  async listTemplates(query: unknown): Promise<NotificationTemplate[]> {
    const parsed = parseListTemplates(query);
    const templates = await this.repo.listTemplates({
      ...(parsed.channel !== undefined ? { channel: parsed.channel } : {}),
      ...(parsed.key !== undefined ? { key: parsed.key } : {}),
      limit: parsed.limit,
    });
    return templates.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, parsed.limit);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.requireTemplate(templateId);
    await this.repo.deleteTemplate(templateId);
  }

  async send(input: unknown): Promise<SendResult> {
    const parsed = parseSend(input);
    const template = await this.repo.findTemplateByKey(parsed.templateKey, parsed.channel);
    if (!template) {
      throw new AppError('NOT_FOUND', {
        message: 'Template not found for this key and channel.',
        details: { templateKey: parsed.templateKey, channel: parsed.channel },
      });
    }
    const variables = parsed.variables ?? {};
    const rendered = renderTemplate(template, variables);
    if (rendered.missing.length > 0) {
      throw new AppError('VALIDATION_ERROR', {
        message: 'Request payload failed validation',
        details: rendered.missing.map((name) => ({
          path: `variables.${name}`,
          message: `missing template variable "${name}"`,
        })),
      });
    }

    const enabled = await this.isChannelEnabled(parsed.userId, parsed.channel);
    if (!enabled) {
      return {
        status: 'suppressed',
        channel: parsed.channel,
        reason: 'preference_disabled',
      };
    }

    const adapter = this.adapters[parsed.channel];
    if (!adapter) {
      throw new AppError('NOT_IMPLEMENTED', {
        message: `No adapter registered for channel "${parsed.channel}".`,
      });
    }
    const result = await adapter.send({
      userId: parsed.userId,
      channel: parsed.channel,
      ...(rendered.title !== undefined ? { title: rendered.title } : {}),
      body: rendered.body,
      ...(parsed.deepLink !== undefined ? { deepLink: parsed.deepLink } : {}),
    });
    return {
      status: 'sent',
      channel: parsed.channel,
      ...(result.providerRef !== undefined ? { providerRef: result.providerRef } : {}),
      ...(result.notificationId !== undefined ? { notificationId: result.notificationId } : {}),
    };
  }

  async getPreferences(userId: string): Promise<Array<{ channel: Channel; enabled: boolean }>> {
    const stored = await this.repo.listPreferences(userId);
    const byChannel = new Map(stored.map((entry) => [entry.channel, entry]));
    return CHANNELS.map((channel) => ({
      channel,
      enabled: byChannel.get(channel)?.enabled ?? true,
    }));
  }

  async setPreference(input: unknown): Promise<{ channel: Channel; enabled: boolean }> {
    const parsed = parseSetPreference(input);
    const preference: NotificationPreference = {
      userId: parsed.userId,
      channel: parsed.channel,
      enabled: parsed.enabled,
      updatedAt: Date.now(),
    };
    await this.repo.savePreference(preference);
    return { channel: parsed.channel, enabled: parsed.enabled };
  }

  async createInApp(input: unknown): Promise<InAppNotification> {
    const parsed = parseCreateInApp(input);
    const adapter = this.adapters.in_app;
    if (!adapter) {
      throw new AppError('NOT_IMPLEMENTED', {
        message: 'No adapter registered for channel "in_app".',
      });
    }
    const result = await adapter.send({
      userId: parsed.userId,
      channel: 'in_app',
      title: parsed.title,
      body: parsed.body ?? parsed.title,
      ...(parsed.deepLink !== undefined ? { deepLink: parsed.deepLink } : {}),
    });
    const notification = await this.repo.findInApp(result.notificationId ?? '');
    if (!notification) {
      throw new AppError('INTERNAL_ERROR', { message: 'Failed to persist notification.' });
    }
    return notification;
  }

  async listInApp(query: unknown): Promise<InAppNotification[]> {
    const parsed = parseListInApp(query);
    return this.repo.listInApp({
      userId: parsed.userId,
      ...(parsed.unreadOnly !== undefined ? { unreadOnly: parsed.unreadOnly === 'true' } : {}),
      limit: parsed.limit,
    });
  }

  async markInAppRead(notificationId: string): Promise<InAppNotification> {
    const notification = await this.repo.findInApp(notificationId);
    if (!notification) {
      throw new AppError('NOT_FOUND', { message: 'Notification not found.' });
    }
    if (!notification.read) {
      notification.read = true;
      await this.repo.saveInApp(notification);
    }
    return notification;
  }

  async markAllInAppRead(userId: string): Promise<{ updated: number }> {
    const updated = await this.repo.markAllInAppRead(userId);
    return { updated };
  }

  private async requireTemplate(templateId: string): Promise<NotificationTemplate> {
    const template = await this.repo.findTemplate(templateId);
    if (!template) {
      throw new AppError('NOT_FOUND', { message: 'Template not found.' });
    }
    return template;
  }

  private async isChannelEnabled(userId: string, channel: Channel): Promise<boolean> {
    const preference = await this.repo.findPreference(userId, channel);
    return preference?.enabled ?? true;
  }
}
