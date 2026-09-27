import { AppError } from '@localwala/errors';
import type {
  Channel,
  InAppNotification,
  NotificationPreference,
  NotificationTemplate,
} from './notification.types.js';

export interface TemplateQuery {
  channel?: Channel;
  key?: string;
  limit?: number;
}

export interface InAppQuery {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
}

export interface NotificationRepository {
  saveTemplate(template: NotificationTemplate): Promise<void>;
  findTemplate(templateId: string): Promise<NotificationTemplate | null>;
  findTemplateByKey(key: string, channel: Channel): Promise<NotificationTemplate | null>;
  listTemplates(query: TemplateQuery): Promise<NotificationTemplate[]>;
  deleteTemplate(templateId: string): Promise<void>;
  findPreference(userId: string, channel: Channel): Promise<NotificationPreference | null>;
  savePreference(preference: NotificationPreference): Promise<void>;
  listPreferences(userId: string): Promise<NotificationPreference[]>;
  saveInApp(notification: InAppNotification): Promise<void>;
  findInApp(notificationId: string): Promise<InAppNotification | null>;
  listInApp(query: InAppQuery): Promise<InAppNotification[]>;
  markAllInAppRead(userId: string): Promise<number>;
}

/**
 * STAGING ONLY — MongoDB notification store not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingNotificationRepository implements NotificationRepository {
  async saveTemplate(): Promise<void> {
    this.blocked('saveTemplate');
  }
  async findTemplate(): Promise<null> {
    this.blocked('findTemplate');
    return null;
  }
  async findTemplateByKey(): Promise<null> {
    this.blocked('findTemplateByKey');
    return null;
  }
  async listTemplates(): Promise<[]> {
    this.blocked('listTemplates');
    return [];
  }
  async deleteTemplate(): Promise<void> {
    this.blocked('deleteTemplate');
  }
  async findPreference(): Promise<null> {
    this.blocked('findPreference');
    return null;
  }
  async savePreference(): Promise<void> {
    this.blocked('savePreference');
  }
  async listPreferences(): Promise<[]> {
    this.blocked('listPreferences');
    return [];
  }
  async saveInApp(): Promise<void> {
    this.blocked('saveInApp');
  }
  async findInApp(): Promise<null> {
    this.blocked('findInApp');
    return null;
  }
  async listInApp(): Promise<[]> {
    this.blocked('listInApp');
    return [];
  }
  async markAllInAppRead(): Promise<number> {
    this.blocked('markAllInAppRead');
    return 0;
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Notification repository not configured: ${op} blocked — MongoDB not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
