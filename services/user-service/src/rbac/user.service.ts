import { AppError } from '@localwala/errors';
import type { UserRepository, UserRecord } from './user.repository.js';
import type { User, Role, UserProfile, Permission } from './rbac.types.js';
import { newUserId } from './rbac.types.js';
import { hasPermission, PERMISSIONS } from './rbac.types.js';

export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async createUser(data: {
    phone: string;
    email?: string;
    name?: string;
    roles?: Role[];
  }): Promise<UserProfile> {
    const existing = await this.userRepo.findByPhone(data.phone);
    if (existing) {
      throw new AppError('CONFLICT', { message: 'User with this phone already exists' });
    }
    if (data.email) {
      const existingEmail = await this.userRepo.findByEmail(data.email);
      if (existingEmail) {
        throw new AppError('CONFLICT', { message: 'User with this email already exists' });
      }
    }

    const now = Date.now();
    const user: UserRecord = {
      id: newUserId(),
      phone: data.phone,
      email: data.email,
      name: data.name,
      roles: data.roles ?? ['customer'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.userRepo.create(user);
    return this.toProfile(user);
  }

  async getUserById(id: string): Promise<UserProfile> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new AppError('NOT_FOUND', { message: 'User not found' });
    return this.toProfile(user);
  }

  async getUserByPhone(phone: string): Promise<UserProfile | null> {
    const user = await this.userRepo.findByPhone(phone);
    return user ? this.toProfile(user) : null;
  }

  async updateUser(id: string, data: Partial<User>): Promise<UserProfile> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new AppError('NOT_FOUND', { message: 'User not found' });

    if (data.email && data.email !== user.email) {
      const existing = await this.userRepo.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new AppError('CONFLICT', { message: 'Email already in use' });
      }
    }

    const updated = await this.userRepo.update(id, { ...data, updatedAt: Date.now() });
    return this.toProfile(updated);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new AppError('NOT_FOUND', { message: 'User not found' });
    await this.userRepo.delete(id);
  }

  async listUsers(filters: {
    role?: Role;
    active?: boolean;
    page: number;
    pageSize: number;
  }): Promise<{ items: UserProfile[]; total: number }> {
    const result = await this.userRepo.list(filters);
    return { items: result.items.map(this.toProfile), total: result.total };
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError('NOT_FOUND', { message: 'User not found' });
    const perms = new Set<Permission>();
    for (const role of user.roles) {
      for (const perm of Object.keys(PERMISSIONS) as Permission[]) {
        if (hasPermission(role, perm)) perms.add(perm);
      }
    }
    return Array.from(perms);
  }

  async checkPermission(userId: string, permission: Permission): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    if (!user) return false;
    return user.roles.some((role: Role) => hasPermission(role, permission));
  }

  private toProfile(user: User): UserProfile {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      roles: user.roles,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
