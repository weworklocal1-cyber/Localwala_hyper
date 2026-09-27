import { AppError } from '@localwala/errors';

export interface UserRecord {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  roles: string[];
  avatarUrl?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  metadata?: Record<string, unknown>;
}

export interface ListUsersFilters {
  role?: string;
  active?: boolean;
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface UserRepository {
  create(user: UserRecord): Promise<void>;
  findById(id: string): Promise<UserRecord | null>;
  findByPhone(phone: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  update(id: string, data: Partial<UserRecord>): Promise<UserRecord>;
  delete(id: string): Promise<void>;
  list(filters: ListUsersFilters): Promise<PaginatedResult<UserRecord>>;
}

/**
 * STAGING ONLY — Replace with Postgres implementation.
 * Throws SERVICE_UNAVAILABLE on every operation.
 */
export class StagingUserRepository implements UserRepository {
  async create(): Promise<never> {
    this.blocked('create');
  }
  async findById(): Promise<null> {
    this.blocked('findById');
    return null;
  }
  async findByPhone(): Promise<null> {
    this.blocked('findByPhone');
    return null;
  }
  async findByEmail(): Promise<null> {
    this.blocked('findByEmail');
    return null;
  }
  async update(): Promise<never> {
    this.blocked('update');
    throw new Error('unreachable');
  }
  async delete(): Promise<void> {
    this.blocked('delete');
  }
  async list(): Promise<{ items: never[]; total: number }> {
    this.blocked('list');
    return { items: [], total: 0 };
  }

  private blocked(op: string): never {
    throw new AppError('SERVICE_UNAVAILABLE', {
      message: `User repository not configured: ${op} blocked — database not available. Run docker compose up -d.`,
      retryable: false,
    });
  }
}
