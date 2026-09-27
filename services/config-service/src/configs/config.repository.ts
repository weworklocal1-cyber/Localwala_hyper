import { AppError } from '@localwala/errors';
import type { ConfigEnvironment, ConfigRecord, ConfigState, ConfigType } from './config.types.js';

export interface ConfigListFilter {
  key?: string;
  environment?: ConfigEnvironment;
  state?: ConfigState;
  type?: ConfigType;
  limit?: number;
}

export interface ConfigRepository {
  save(record: ConfigRecord): Promise<void>;
  findById(id: string): Promise<ConfigRecord | null>;
  findByKey(key: string, environment: ConfigEnvironment): Promise<ConfigRecord[]>;
  list(filter: ConfigListFilter): Promise<ConfigRecord[]>;
  delete(id: string): Promise<void>;
}

/**
 * STAGING ONLY — MongoDB repository not implemented yet.
 * Throws SERVICE_UNAVAILABLE (503) on every operation (specification section 1).
 */
export class StagingConfigRepository implements ConfigRepository {
  async save(): Promise<void> {
    this.blocked('save');
  }
  async findById(): Promise<null> {
    this.blocked('findById');
    return null;
  }
  async findByKey(): Promise<[]> {
    this.blocked('findByKey');
    return [];
  }
  async list(): Promise<[]> {
    this.blocked('list');
    return [];
  }
  async delete(): Promise<void> {
    this.blocked('delete');
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `Config repository not configured: ${op} blocked — MongoDB not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
