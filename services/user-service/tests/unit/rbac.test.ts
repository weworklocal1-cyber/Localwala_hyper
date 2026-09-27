import { beforeEach, describe, expect, it } from 'vitest';
import type {
  ListUsersFilters,
  PaginatedResult,
  UserRecord,
  UserRepository,
} from '../../src/rbac/user.repository.js';
import { UserService } from '../../src/rbac/user.service.js';
import {
  PERMISSIONS,
  ROLES,
  getPermissionsForRole,
  hasAnyPermission,
  hasPermission,
  type Permission,
  type Role,
} from '../../src/rbac/rbac.types.js';

const allPermissions = Object.keys(PERMISSIONS) as Permission[];

class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, UserRecord>();

  async create(user: UserRecord): Promise<void> {
    this.users.set(user.id, { ...user, roles: [...user.roles] });
  }
  async findById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? { ...user, roles: [...user.roles] } : null;
  }
  async findByPhone(phone: string): Promise<UserRecord | null> {
    for (const user of this.users.values()) {
      if (user.phone === phone) return { ...user, roles: [...user.roles] };
    }
    return null;
  }
  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return { ...user, roles: [...user.roles] };
    }
    return null;
  }
  async update(id: string, data: Partial<UserRecord>): Promise<UserRecord> {
    const user = this.users.get(id);
    if (!user) throw new Error('user not found');
    const updated: UserRecord = { ...user, ...data, roles: [...(data.roles ?? user.roles)] };
    this.users.set(id, updated);
    return { ...updated, roles: [...updated.roles] };
  }
  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
  async list(filters: ListUsersFilters): Promise<PaginatedResult<UserRecord>> {
    const filtered = [...this.users.values()].filter(
      (user) =>
        (filters.role === undefined || user.roles.includes(filters.role)) &&
        (filters.active === undefined || user.isActive === filters.active),
    );
    const start = (filters.page - 1) * filters.pageSize;
    return {
      items: filtered.slice(start, start + filters.pageSize).map((user) => ({
        ...user,
        roles: [...user.roles],
      })),
      total: filtered.length,
    };
  }
}

describe('RBAC permission matrix', () => {
  it('defines 9 unique roles', () => {
    expect(ROLES).toHaveLength(9);
    expect(new Set(ROLES).size).toBe(9);
  });

  it('only grants permissions to known roles', () => {
    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
      for (const role of roles) {
        expect(ROLES).toContain(role);
        expect(typeof permission).toBe('string');
      }
    }
  });

  it('grants super_admin every permission', () => {
    expect(getPermissionsForRole('super_admin').sort()).toEqual([...allPermissions].sort());
  });

  it('grants each permission to at least one role', () => {
    for (const permission of allPermissions) {
      expect(PERMISSIONS[permission].length).toBeGreaterThan(0);
    }
  });

  it('restricts user:delete to super_admin only', () => {
    expect(PERMISSIONS['user:delete']).toEqual(['super_admin']);
  });

  it('answers hasPermission per the matrix', () => {
    expect(hasPermission('customer', 'order:cancel')).toBe(true);
    expect(hasPermission('customer', 'payment:read')).toBe(false);
    expect(hasPermission('admin', 'user:delete')).toBe(false);
    expect(hasPermission('super_admin', 'user:delete')).toBe(true);
    expect(hasPermission('delivery_partner', 'delivery:assign')).toBe(false);
    expect(hasPermission('delivery_partner', 'delivery:read')).toBe(true);
    expect(hasPermission('support_agent', 'user:read')).toBe(true);
    expect(hasPermission('support_agent', 'config:write')).toBe(false);
  });

  it('answers hasAnyPermission when any or none match', () => {
    expect(hasAnyPermission('customer', ['payment:read', 'order:cancel'])).toBe(true);
    expect(hasAnyPermission('customer', ['payment:read', 'user:write'])).toBe(false);
    expect(hasAnyPermission('customer', [])).toBe(false);
    expect(hasAnyPermission('manager', ['analytics:read', 'user:delete'])).toBe(true);
  });

  it('round-trips getPermissionsForRole against hasPermission', () => {
    for (const role of ROLES) {
      const granted = getPermissionsForRole(role);
      for (const permission of allPermissions) {
        expect(granted.includes(permission)).toBe(hasPermission(role, permission));
      }
    }
  });

  it('gives the customer role shopping permissions but no admin powers', () => {
    const granted = getPermissionsForRole('customer');
    expect(granted).toContain('order:cancel');
    expect(granted).toContain('catalog:read');
    expect(granted).toContain('delivery:track');
    expect(granted).not.toContain('user:write');
    expect(granted).not.toContain('config:write');
    expect(granted).not.toContain('payment:refund');
  });

  it('gives the delivery_partner role fulfilment permissions but no payments', () => {
    const granted = getPermissionsForRole('delivery_partner');
    expect(granted).toContain('order:read');
    expect(granted).toContain('delivery:read');
    expect(granted).toContain('delivery:track');
    expect(granted).not.toContain('payment:read');
    expect(granted).not.toContain('settlement:read');
    expect(granted).not.toContain('order:cancel');
  });

  it('keeps executive free of API permissions today', () => {
    expect(getPermissionsForRole('executive')).toEqual([]);
    for (const permission of allPermissions) {
      expect(hasPermission('executive', permission)).toBe(false);
    }
  });
});

describe('UserService permissions', () => {
  let repo: InMemoryUserRepository;
  let service: UserService;
  let phoneSeq = 0;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
    service = new UserService(repo);
  });

  async function createUser(roles?: Role[]): Promise<UserRecord> {
    phoneSeq += 1;
    const profile = await service.createUser({
      phone: `+9112345678${String(phoneSeq).padStart(4, '0')}`,
      roles,
    });
    const user = await repo.findById(profile.id);
    if (!user) throw new Error('seed failed');
    return user;
  }

  it('unions permissions across all assigned roles without duplicates', async () => {
    const user = await createUser(['customer', 'delivery_partner']);
    const permissions = await service.getUserPermissions(user.id);

    expect(permissions).toContain('order:cancel');
    expect(permissions).toContain('delivery:read');
    expect(new Set(permissions).size).toBe(permissions.length);
    const expected = new Set<Permission>();
    for (const role of user.roles) {
      for (const permission of getPermissionsForRole(role)) expected.add(permission);
    }
    expect(new Set(permissions)).toEqual(expected);
  });

  it('404s for an unknown user', async () => {
    await expect(service.getUserPermissions('usr_missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('checks permission as true when any role grants it', async () => {
    const user = await createUser(['customer', 'delivery_partner']);
    expect(await service.checkPermission(user.id, 'order:cancel')).toBe(true);
    expect(await service.checkPermission(user.id, 'delivery:read')).toBe(true);
    expect(await service.checkPermission(user.id, 'payment:refund')).toBe(false);
  });

  it('checks permission as false for an unknown user', async () => {
    expect(await service.checkPermission('usr_missing', 'user:read')).toBe(false);
  });

  it('applies the permission difference between roles', async () => {
    const customer = await createUser(['customer']);
    const admin = await createUser(['admin']);

    expect(await service.checkPermission(customer.id, 'user:read')).toBe(false);
    expect(await service.checkPermission(admin.id, 'user:read')).toBe(true);
    expect(await service.checkPermission(admin.id, 'user:delete')).toBe(false);

    const superAdmin = await createUser(['super_admin']);
    expect(await service.checkPermission(superAdmin.id, 'user:delete')).toBe(true);
  });
});

describe('UserService user lifecycle', () => {
  let repo: InMemoryUserRepository;
  let service: UserService;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
    service = new UserService(repo);
  });

  it('creates a user with the customer default role', async () => {
    const profile = await service.createUser({ phone: '+911234567890' });
    expect(profile.roles).toEqual(['customer']);
    expect(profile.id).toMatch(/^usr_/);
  });

  it('rejects a duplicate phone', async () => {
    await service.createUser({ phone: '+911234567890' });
    await expect(service.createUser({ phone: '+911234567890' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('rejects a duplicate email', async () => {
    await service.createUser({ phone: '+911234567890', email: 'a@example.com' });
    await expect(
      service.createUser({ phone: '+919999999999', email: 'a@example.com' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects an email already used by the same user on update to another user', async () => {
    await service.createUser({ phone: '+911111111111', email: 'a@example.com' });
    const second = await service.createUser({ phone: '+912222222222', email: 'b@example.com' });
    await expect(service.updateUser(second.id, { email: 'a@example.com' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('404s for an unknown user', async () => {
    await expect(service.getUserById('usr_missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.deleteUser('usr_missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.updateUser('usr_missing', { name: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('lists users filtered by role and active state', async () => {
    await service.createUser({ phone: '+911111111111' });
    await service.createUser({ phone: '+912222222222', roles: ['admin'] });
    const second = await service.createUser({ phone: '+913333333333' });
    await service.updateUser(second.id, { isActive: false });

    const admins = await service.listUsers({ role: 'admin', page: 1, pageSize: 10 });
    expect(admins.total).toBe(1);

    const active = await service.listUsers({ active: true, page: 1, pageSize: 10 });
    expect(active.total).toBe(2);

    const page = await service.listUsers({ page: 2, pageSize: 2 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(3);
  });
});
