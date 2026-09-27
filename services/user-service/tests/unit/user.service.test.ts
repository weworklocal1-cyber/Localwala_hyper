import { beforeEach, describe, expect, it } from 'vitest';
import { StagingUserRepository } from '../../src/rbac/user.repository.js';
import { UserService } from '../../src/rbac/user.service.js';

describe('UserService', () => {
  let userRepo: StagingUserRepository;
  let userService: UserService;

  beforeEach(() => {
    userRepo = new StagingUserRepository();
    userService = new UserService(userRepo);
  });

  it('throws BLOCKED on createUser (staging repo)', async () => {
    await expect(userService.createUser({ phone: '+919876543210' })).rejects.toThrow(
      'User repository not configured',
    );
  });

  it('throws BLOCKED on getUserById (staging repo)', async () => {
    await expect(userService.getUserById('usr_1')).rejects.toThrow(
      'User repository not configured',
    );
  });

  it('throws BLOCKED on updateUser (staging repo)', async () => {
    await expect(userService.updateUser('usr_1', { name: 'Test' })).rejects.toThrow(
      'User repository not configured',
    );
  });

  it('throws BLOCKED on deleteUser (staging repo)', async () => {
    await expect(userService.deleteUser('usr_1')).rejects.toThrow('User repository not configured');
  });

  it('throws BLOCKED on listUsers (staging repo)', async () => {
    await expect(userService.listUsers({ page: 1, pageSize: 20 })).rejects.toThrow(
      'User repository not configured',
    );
  });

  it('throws BLOCKED on getUserPermissions (staging repo)', async () => {
    await expect(userService.getUserPermissions('usr_1')).rejects.toThrow(
      'User repository not configured',
    );
  });

  it('throws BLOCKED on checkPermission (staging repo)', async () => {
    await expect(userService.checkPermission('usr_1', 'user:read')).rejects.toThrow(
      'User repository not configured',
    );
  });
});
