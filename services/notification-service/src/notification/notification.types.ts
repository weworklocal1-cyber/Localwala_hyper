import { randomUUID } from 'node:crypto';

export const CHANNELS = ['push', 'sms', 'email', 'whatsapp', 'in_app'] as const;

export type Channel = (typeof CHANNELS)[number];

export interface NotificationTemplate {
  id: string;
  key: string;
  channel: Channel;
  title?: string;
  body: string;
  locale: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationPreference {
  userId: string;
  channel: Channel;
  enabled: boolean;
  updatedAt: number;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body?: string;
  deepLink?: string;
  read: boolean;
  createdAt: number;
}

export interface OutgoingMessage {
  userId: string;
  channel: Channel;
  title?: string;
  body: string;
  deepLink?: string;
}

export interface SendResult {
  status: 'sent' | 'suppressed';
  channel: Channel;
  providerRef?: string;
  notificationId?: string;
  reason?: string;
}

export const USER_ID_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
export const TEMPLATE_KEY_PATTERN = '^[a-z0-9][a-z0-9_-]{1,63}$';
export const TEMPLATE_ID_PATTERN = '^tpl_[0-9a-f]{32}$';
export const IN_APP_ID_PATTERN = '^ian_[0-9a-f]{32}$';
export const LOCALE_PATTERN = '^[a-z]{2}(-[A-Z]{2})?$';
export const DEEP_LINK_PATTERN = '^(\\/|https?:\\/\\/).{0,298}$';

export function newTemplateId(): string {
  return `tpl_${randomUUID().replace(/-/g, '')}`;
}

export function newInAppId(): string {
  return `ian_${randomUUID().replace(/-/g, '')}`;
}

export function renderTemplate(
  template: { title?: string; body: string },
  variables: Record<string, string | number>,
): { title?: string; body: string; missing: string[] } {
  const pattern = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
  const missing = new Set<string>();

  const substitute = (text: string): string =>
    text.replace(pattern, (_match, name: string) => {
      const value = variables[name];
      if (value === undefined) {
        missing.add(name);
        return _match;
      }
      return String(value);
    });

  const result: { title?: string; body: string; missing: string[] } = {
    body: substitute(template.body),
    missing: [],
  };
  if (template.title !== undefined) result.title = substitute(template.title);
  result.missing = [...missing];
  return result;
}
