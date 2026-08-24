import { describe, expect, it } from 'vitest';
import access from './access';

describe('access', () => {
  it('should return canAdmin true when user has system:manage permission', () => {
    const initialState = {
      currentUser: {
        userid: '1',
        name: 'Admin User',
        avatar: 'https://example.com/avatar.png',
        access: 'admin',
        permissions: ['system:manage', 'dashboard:view', 'system:user'],
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(true);
  });

  it('should return canAdmin false when user lacks admin permissions', () => {
    const initialState = {
      currentUser: {
        userid: '2',
        name: 'Regular User',
        avatar: 'https://example.com/avatar.png',
        access: 'user',
        permissions: ['dashboard:view', 'flow:manage'],
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(false);
  });

  it('should return canAdmin false when user has no permissions', () => {
    const initialState = {
      currentUser: {
        userid: '3',
        name: 'Guest User',
        avatar: 'https://example.com/avatar.png',
        permissions: [],
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(false);
  });

  it('should return canAdmin false when currentUser is undefined', () => {
    const initialState = {
      currentUser: undefined,
    };

    const result = access(initialState);

    expect(result.canAdmin).toBeFalsy();
  });

  it('should return canAdmin false when initialState is undefined', () => {
    const result = access(undefined);

    expect(result.canAdmin).toBeFalsy();
  });

  it('should expose permission codes as truthy and support can()', () => {
    const initialState = {
      currentUser: {
        userid: '1',
        name: 'Admin',
        permissions: ['system:user', 'system:user:create'],
      },
    };

    const result = access(initialState);

    expect(result['system:user']).toBe(true);
    expect(result['system:user:create']).toBe(true);
    expect(result['system:role']).toBeUndefined();
    expect(result.can('system:user')).toBe(true);
    expect(result.can('system:role')).toBe(false);
  });
});
