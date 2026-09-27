import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@localwala/errors';
import {
  StagingNotificationRepository,
  type InAppQuery,
  type NotificationRepository,
  type TemplateQuery,
} from '../../src/notification/notification.repository.js';
import { NotificationService } from '../../src/notification/notification.service.js';
import {
  StagingExternalAdapter,
  InAppChannelAdapter,
  type ChannelAdapter,
  type AdapterResult,
} from '../../src/notification/adapters.js';
import {
  CHANNELS,
  renderTemplate,
  type Channel,
  type InAppNotification,
  type NotificationPreference,
  type NotificationTemplate,
  type OutgoingMessage,
} from '../../src/notification/notification.types.js';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

class InMemoryNotificationRepository implements NotificationRepository {
  readonly templates = new Map<string, NotificationTemplate>();
  readonly preferences = new Map<string, NotificationPreference>();
  readonly inApp = new Map<string, InAppNotification>();

  async saveTemplate(template: NotificationTemplate): Promise<void> {
    await tick();
    this.templates.set(template.id, { ...template });
  }
  async findTemplate(templateId: string): Promise<NotificationTemplate | null> {
    await tick();
    const template = this.templates.get(templateId);
    return template ? { ...template } : null;
  }
  async findTemplateByKey(key: string, channel: Channel): Promise<NotificationTemplate | null> {
    await tick();
    for (const template of this.templates.values()) {
      if (template.key === key && template.channel === channel) return { ...template };
    }
    return null;
  }
  async listTemplates(query: TemplateQuery): Promise<NotificationTemplate[]> {
    await tick();
    return [...this.templates.values()]
      .filter((template) => query.channel === undefined || template.channel === query.channel)
      .filter((template) => query.key === undefined || template.key === query.key)
      .slice(0, query.limit ?? 50)
      .map((template) => ({ ...template }));
  }
  async deleteTemplate(templateId: string): Promise<void> {
    await tick();
    this.templates.delete(templateId);
  }
  async findPreference(userId: string, channel: Channel): Promise<NotificationPreference | null> {
    await tick();
    const preference = this.preferences.get(`${userId}:${channel}`);
    return preference ? { ...preference } : null;
  }
  async savePreference(preference: NotificationPreference): Promise<void> {
    await tick();
    this.preferences.set(`${preference.userId}:${preference.channel}`, { ...preference });
  }
  async listPreferences(userId: string): Promise<NotificationPreference[]> {
    await tick();
    return [...this.preferences.values()]
      .filter((preference) => preference.userId === userId)
      .map((preference) => ({ ...preference }));
  }
  async saveInApp(notification: InAppNotification): Promise<void> {
    await tick();
    this.inApp.set(notification.id, { ...notification });
  }
  async findInApp(notificationId: string): Promise<InAppNotification | null> {
    await tick();
    const notification = this.inApp.get(notificationId);
    return notification ? { ...notification } : null;
  }
  async listInApp(query: InAppQuery): Promise<InAppNotification[]> {
    await tick();
    return [...this.inApp.values()]
      .filter((notification) => notification.userId === query.userId)
      .filter((notification) => query.unreadOnly !== true || !notification.read)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, query.limit ?? 20)
      .map((notification) => ({ ...notification }));
  }
  async markAllInAppRead(userId: string): Promise<number> {
    await tick();
    let updated = 0;
    for (const notification of this.inApp.values()) {
      if (notification.userId === userId && !notification.read) {
        notification.read = true;
        updated += 1;
      }
    }
    return updated;
  }
}

class RecordingAdapter implements ChannelAdapter {
  readonly sent: OutgoingMessage[] = [];
  private counter = 0;

  async send(message: OutgoingMessage): Promise<AdapterResult> {
    this.sent.push({ ...message });
    this.counter += 1;
    return { providerRef: `prov_${this.counter}` };
  }
}

describe('renderTemplate', () => {
  it('substitutes title and body variables', () => {
    const result = renderTemplate(
      { title: 'Hi {{name}}', body: 'Order {{orderId}} is {{state}}' },
      { name: 'Asha', orderId: 'ord_1', state: 'ready' },
    );
    expect(result.title).toBe('Hi Asha');
    expect(result.body).toBe('Order ord_1 is ready');
    expect(result.missing).toEqual([]);
  });

  it('tolerates whitespace inside placeholders and renders numbers', () => {
    const result = renderTemplate({ body: 'OTP {{ code }}' }, { code: 4219 });
    expect(result.body).toBe('OTP 4219');
    expect(result.missing).toEqual([]);
  });

  it('reports missing variables without substituting them', () => {
    const result = renderTemplate({ title: 'Hi {{name}}', body: 'Welcome {{name}}' }, {});
    expect(result.title).toBe('Hi {{name}}');
    expect(result.missing).toEqual(['name']);
  });
});

describe('NotificationService', () => {
  let repo: InMemoryNotificationRepository;
  let service: NotificationService;
  let push: RecordingAdapter;

  beforeEach(() => {
    repo = new InMemoryNotificationRepository();
    push = new RecordingAdapter();
    service = new NotificationService(repo, {
      push,
      in_app: new InAppChannelAdapter(repo),
    });
  });

  const templatePayload = {
    key: 'order_confirmed',
    channel: 'push',
    title: 'Order confirmed',
    body: 'Your order {{orderId}} is confirmed.',
  };

  const createTemplate = (overrides: Record<string, unknown> = {}) =>
    service.createTemplate({ ...templatePayload, ...overrides });

  describe('templates', () => {
    it('creates a template with a generated id and en locale default', async () => {
      const template = await createTemplate();
      expect(template.id).toMatch(/^tpl_[0-9a-f]{32}$/);
      expect(template.locale).toBe('en');
      expect(template.createdAt).toBe(template.updatedAt);
      expect(template.title).toBe('Order confirmed');
    });

    it('rejects a duplicate key for the same channel', async () => {
      await createTemplate();
      const error = await createTemplate().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('CONFLICT');
    });

    it('allows the same key on a different channel', async () => {
      await createTemplate();
      const sms = await service.createTemplate({
        key: 'order_confirmed',
        channel: 'sms',
        body: 'Order {{orderId}} confirmed',
      });
      expect(sms.channel).toBe('sms');
      expect(sms.title).toBeUndefined();
    });

    it('rejects an invalid template payload', async () => {
      const error = await service
        .createTemplate({ key: 'Bad Key!', channel: 'push', body: 'x' })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for an unknown template id', async () => {
      await expect(service.getTemplate(`tpl_${'a'.repeat(32)}`)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('updates body, title and locale and advances updatedAt', async () => {
      const created = await createTemplate();
      await new Promise((resolve) => setTimeout(resolve, 2));
      const updated = await service.updateTemplate(created.id, {
        title: 'Confirmed',
        body: 'Order {{orderId}} is done.',
        locale: 'hi',
      });
      expect(updated.title).toBe('Confirmed');
      expect(updated.body).toBe('Order {{orderId}} is done.');
      expect(updated.locale).toBe('hi');
      expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    });

    it('removes the title when it is set to null', async () => {
      const created = await createTemplate();
      const updated = await service.updateTemplate(created.id, { title: null });
      expect(updated.title).toBeUndefined();
    });

    it('rejects an empty update payload', async () => {
      const created = await createTemplate();
      const error = await service.updateTemplate(created.id, {}).catch((e: unknown) => e);
      expect((error as AppError).code).toBe('VALIDATION_ERROR');
    });

    it('rejects an update to an unknown template', async () => {
      await expect(
        service.updateTemplate(`tpl_${'b'.repeat(32)}`, { body: 'x' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('deletes a template', async () => {
      const created = await createTemplate();
      await service.deleteTemplate(created.id);
      await expect(service.getTemplate(created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects deleting an unknown template', async () => {
      await expect(service.deleteTemplate(`tpl_${'c'.repeat(32)}`)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('lists templates filtered by channel and key', async () => {
      await createTemplate();
      await createTemplate({ channel: 'sms', body: 'sms body' });
      const byChannel = await service.listTemplates({ channel: 'sms' });
      expect(byChannel).toHaveLength(1);
      expect(byChannel[0]?.channel).toBe('sms');
      const byKey = await service.listTemplates({ key: 'order_confirmed' });
      expect(byKey).toHaveLength(2);
      const mismatch = await service.listTemplates({ key: 'other_key' });
      expect(mismatch).toHaveLength(0);
    });

    it('sorts listings by updatedAt descending and honours the limit', async () => {
      const first = await createTemplate({ key: 'first' });
      await new Promise((resolve) => setTimeout(resolve, 2));
      await createTemplate({ key: 'second' });
      await service.updateTemplate(first.id, { body: 'refreshed {{orderId}}' });
      const templates = await service.listTemplates({ limit: 1 });
      expect(templates).toHaveLength(1);
      expect(templates[0]?.key).toBe('first');
    });
  });

  describe('send', () => {
    it('renders the template and sends through the channel adapter', async () => {
      await createTemplate();
      const result = await service.send({
        userId: 'usr_1',
        channel: 'push',
        templateKey: 'order_confirmed',
        variables: { orderId: 'ord_123' },
      });
      expect(result.status).toBe('sent');
      expect(result.channel).toBe('push');
      expect(result.providerRef).toBe('prov_1');
      expect(push.sent).toHaveLength(1);
      expect(push.sent[0]?.body).toBe('Your order ord_123 is confirmed.');
      expect(push.sent[0]?.title).toBe('Order confirmed');
    });

    it('returns 404 for an unknown template key', async () => {
      await expect(
        service.send({ userId: 'usr_1', channel: 'push', templateKey: 'mystery' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(push.sent).toHaveLength(0);
    });

    it('fails validation when a template variable is missing', async () => {
      await createTemplate();
      const error = await service
        .send({ userId: 'usr_1', channel: 'push', templateKey: 'order_confirmed' })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('VALIDATION_ERROR');
      expect((error as AppError).details).toEqual([
        { path: 'variables.orderId', message: 'missing template variable "orderId"' },
      ]);
      expect(push.sent).toHaveLength(0);
    });

    it('suppresses delivery when the user opted out of the channel', async () => {
      await createTemplate();
      await service.setPreference({ userId: 'usr_1', channel: 'push', enabled: false });
      const result = await service.send({
        userId: 'usr_1',
        channel: 'push',
        templateKey: 'order_confirmed',
        variables: { orderId: 'ord_1' },
      });
      expect(result.status).toBe('suppressed');
      expect(result.reason).toBe('preference_disabled');
      expect(push.sent).toHaveLength(0);
    });

    it('resumes delivery once the preference is re-enabled', async () => {
      await createTemplate();
      await service.setPreference({ userId: 'usr_1', channel: 'push', enabled: false });
      await service.setPreference({ userId: 'usr_1', channel: 'push', enabled: true });
      const result = await service.send({
        userId: 'usr_1',
        channel: 'push',
        templateKey: 'order_confirmed',
        variables: { orderId: 'ord_2' },
      });
      expect(result.status).toBe('sent');
      expect(push.sent).toHaveLength(1);
    });

    it('passes the deep link through to the adapter', async () => {
      await createTemplate();
      const result = await service.send({
        userId: 'usr_1',
        channel: 'push',
        templateKey: 'order_confirmed',
        variables: { orderId: 'ord_1' },
        deepLink: '/orders/ord_1',
      });
      expect(result.status).toBe('sent');
      expect(push.sent[0]?.deepLink).toBe('/orders/ord_1');
    });

    it('delivers an in_app send into the notification store', async () => {
      await createTemplate({ channel: 'in_app', body: 'New message for {{orderId}}' });
      const result = await service.send({
        userId: 'usr_1',
        channel: 'in_app',
        templateKey: 'order_confirmed',
        variables: { orderId: 'ord_7' },
      });
      expect(result.status).toBe('sent');
      expect(result.notificationId).toMatch(/^ian_[0-9a-f]{32}$/);
      const stored = await repo.findInApp(result.notificationId ?? '');
      expect(stored?.body).toBe('New message for ord_7');
      expect(stored?.read).toBe(false);
    });

    it('rejects a channel with no adapter registered', async () => {
      await service.createTemplate({ key: 'welcome_email', channel: 'email', body: 'Hello' });
      const bare = new NotificationService(repo, {});
      await expect(
        bare.send({ userId: 'usr_1', channel: 'email', templateKey: 'welcome_email' }),
      ).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    });
  });

  describe('preferences', () => {
    it('defaults every channel to enabled', async () => {
      const preferences = await service.getPreferences('usr_new');
      expect(preferences.map((entry) => entry.channel)).toEqual([...CHANNELS]);
      expect(preferences.every((entry) => entry.enabled)).toBe(true);
    });

    it('persists a single channel opt-out without touching the others', async () => {
      await service.setPreference({ userId: 'usr_1', channel: 'sms', enabled: false });
      const preferences = await service.getPreferences('usr_1');
      const sms = preferences.find((entry) => entry.channel === 'sms');
      const pushPref = preferences.find((entry) => entry.channel === 'push');
      expect(sms?.enabled).toBe(false);
      expect(pushPref?.enabled).toBe(true);
    });

    it('rejects an unknown channel', async () => {
      await expect(
        service.setPreference({ userId: 'usr_1', channel: 'carrier_pigeon', enabled: true }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('in-app notifications', () => {
    it('creates an unread notification', async () => {
      const notification = await service.createInApp({
        userId: 'usr_1',
        title: 'Order shipped',
        body: 'It is on the way',
        deepLink: '/orders/ord_9',
      });
      expect(notification.id).toMatch(/^ian_[0-9a-f]{32}$/);
      expect(notification.read).toBe(false);
      expect(notification.title).toBe('Order shipped');
    });

    it('rejects an invalid payload', async () => {
      await expect(service.createInApp({ userId: 'bad id!', title: 'x' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('lists a user notifications', async () => {
      await service.createInApp({ userId: 'usr_1', title: 'One' });
      await service.createInApp({ userId: 'usr_1', title: 'Two' });
      await service.createInApp({ userId: 'usr_2', title: 'Other user' });
      const notifications = await service.listInApp({ userId: 'usr_1', limit: 20 });
      expect(notifications).toHaveLength(2);
      expect(notifications.map((entry) => entry.title).sort()).toEqual(['One', 'Two']);
    });

    it('filters unread notifications', async () => {
      const first = await service.createInApp({ userId: 'usr_1', title: 'Read me' });
      await service.createInApp({ userId: 'usr_1', title: 'Unread' });
      await service.markInAppRead(first.id);
      const unread = await service.listInApp({ userId: 'usr_1', unreadOnly: 'true', limit: 20 });
      expect(unread).toHaveLength(1);
      expect(unread[0]?.title).toBe('Unread');
    });

    it('marks a notification as read idempotently', async () => {
      const notification = await service.createInApp({ userId: 'usr_1', title: 'Hello' });
      const read = await service.markInAppRead(notification.id);
      expect(read.read).toBe(true);
      const again = await service.markInAppRead(notification.id);
      expect(again.read).toBe(true);
    });

    it('returns 404 when marking an unknown notification read', async () => {
      await expect(service.markInAppRead(`ian_${'d'.repeat(32)}`)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('marks all unread notifications read and reports the count', async () => {
      await service.createInApp({ userId: 'usr_1', title: 'A' });
      await service.createInApp({ userId: 'usr_1', title: 'B' });
      await service.createInApp({ userId: 'usr_2', title: 'Other' });
      const first = await service.markAllInAppRead('usr_1');
      expect(first.updated).toBe(2);
      const second = await service.markAllInAppRead('usr_1');
      expect(second.updated).toBe(0);
      const other = await service.listInApp({ userId: 'usr_2', limit: 20 });
      expect(other[0]?.read).toBe(false);
    });
  });
});

describe('staging adapters', () => {
  it('blocks external channel sends', async () => {
    const adapter = new StagingExternalAdapter('push');
    const error = await adapter
      .send({ userId: 'usr_1', channel: 'push', body: 'hi' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as AppError).message).toContain('push channel adapter not configured');
  });
});

describe('staging notification repository', () => {
  const repo = new StagingNotificationRepository();
  const expectBlocked = async (operation: Promise<unknown>) => {
    const error = await operation.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as AppError).message).toContain('MongoDB not available');
  };

  it('blocks template writes and reads', async () => {
    await expectBlocked(repo.saveTemplate({} as NotificationTemplate));
    await expectBlocked(repo.findTemplate('tpl_x'));
    await expectBlocked(repo.findTemplateByKey('k', 'push'));
    await expectBlocked(repo.listTemplates({}));
    await expectBlocked(repo.deleteTemplate('tpl_x'));
  });

  it('blocks preference and in-app operations', async () => {
    await expectBlocked(repo.findPreference('usr_1', 'push'));
    await expectBlocked(repo.savePreference({} as NotificationPreference));
    await expectBlocked(repo.listPreferences('usr_1'));
    await expectBlocked(repo.saveInApp({} as InAppNotification));
    await expectBlocked(repo.findInApp('ian_x'));
    await expectBlocked(repo.listInApp({ userId: 'usr_1' }));
    await expectBlocked(repo.markAllInAppRead('usr_1'));
  });
});
