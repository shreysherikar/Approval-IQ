import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/auth/auth.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';

interface TestUser {
  id: string;
  email: string;
  passwordHash?: string | null;
  googleId?: string | null;
  authProvider?: string;
  role: 'applicant' | 'officer' | 'admin';
  createdAt?: Date;
  updatedAt?: Date;
}

test('AuthService.validateOrCreateGoogleUser creates new user when neither googleId nor email exists', async () => {
  const users: TestUser[] = [];
  const mockPrisma = {
    user: {
      findUnique: async ({ where }: { where: { googleId?: string; email?: string } }) => {
        if (where.googleId) return users.find((u) => u.googleId === where.googleId) ?? null;
        if (where.email) return users.find((u) => u.email === where.email) ?? null;
        return null;
      },
      create: async ({ data }: { data: Omit<TestUser, 'id'> }) => {
        const newUser: TestUser = { id: 'user-new-1', ...data, createdAt: new Date(), updatedAt: new Date() };
        users.push(newUser);
        return newUser;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<TestUser> }) => {
        const user = users.find((u) => u.id === where.id);
        if (user) Object.assign(user, data);
        return user!;
      },
    },
  } as unknown as PrismaService;

  const mockJwt = {
    signAsync: async (payload: { sub: string }) => `jwt-${payload.sub}`,
  } as unknown as JwtService;

  const mockConfig = {
    getOrThrow: (key: string) => (key === 'JWT_REFRESH_EXPIRY' ? '7d' : 'secret'),
    get: (key: string) => (key === 'JWT_REFRESH_EXPIRY' ? '7d' : 'secret'),
  } as unknown as ConfigService;

  const service = new AuthService(mockPrisma, mockJwt, mockConfig);

  const profile = { googleId: 'google-123', email: 'applicant@example.com' };
  const user = await service.validateOrCreateGoogleUser(profile);

  assert.equal(user.email, 'applicant@example.com');
  assert.equal(user.googleId, 'google-123');
  assert.equal(user.authProvider, 'google');
  assert.equal(user.role, 'applicant');
});

test('AuthService.validateOrCreateGoogleUser links googleId when user with email already exists', async () => {
  const existingUser: TestUser = {
    id: 'user-existing-1',
    email: 'existing@example.com',
    passwordHash: 'hash123',
    googleId: null,
    authProvider: 'local',
    role: 'applicant',
  };

  const users: TestUser[] = [existingUser];
  const mockPrisma = {
    user: {
      findUnique: async ({ where }: { where: { googleId?: string; email?: string } }) => {
        if (where.googleId) return users.find((u) => u.googleId === where.googleId) ?? null;
        if (where.email) return users.find((u) => u.email === where.email) ?? null;
        return null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<TestUser> }) => {
        const user = users.find((u) => u.id === where.id);
        if (user) Object.assign(user, data);
        return user!;
      },
    },
  } as unknown as PrismaService;

  const mockJwt = { signAsync: async () => 'mock-jwt' } as unknown as JwtService;
  const mockConfig = { getOrThrow: () => '7d', get: () => '7d' } as unknown as ConfigService;

  const service = new AuthService(mockPrisma, mockJwt, mockConfig);

  const user = await service.validateOrCreateGoogleUser({
    googleId: 'google-456',
    email: 'existing@example.com',
  });

  assert.equal(user.id, 'user-existing-1');
  assert.equal(user.googleId, 'google-456');
  assert.equal(user.passwordHash, 'hash123');
});

test('AuthService.issueTokensForUser issues valid access and refresh token pair', async () => {
  const signedPayloads: Array<{ payload: { sub: string; email: string; type?: string }; options?: { expiresIn?: string } }> = [];
  const mockJwt = {
    signAsync: async (payload: { sub: string; email: string; type?: string }, options?: { expiresIn?: string }) => {
      signedPayloads.push({ payload, options });
      return `signed-${payload.sub}-${payload.type || 'access'}`;
    },
  } as unknown as JwtService;

  const mockConfig = {
    getOrThrow: (key: string) => (key === 'JWT_REFRESH_EXPIRY' ? '7d' : 'secret'),
    get: (key: string) => (key === 'JWT_REFRESH_EXPIRY' ? '7d' : 'secret'),
  } as unknown as ConfigService;

  const service = new AuthService({} as unknown as PrismaService, mockJwt, mockConfig);

  const tokens = await service.issueTokensForUser({
    id: 'user-999',
    email: 'test@example.com',
    role: 'applicant',
  });

  assert.equal(tokens.accessToken, 'signed-user-999-access');
  assert.equal(tokens.refreshToken, 'signed-user-999-refresh');
  assert.equal(signedPayloads.length, 2);
  assert.equal(signedPayloads[0].payload.sub, 'user-999');
  assert.equal(signedPayloads[1].options?.expiresIn, '7d');
});
