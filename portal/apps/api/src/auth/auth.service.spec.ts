import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Unit-level coverage for googleLogin()'s rejection paths that don't need a real Google
// token (P17 Part 3) -- stub verifyIdToken instead. The live end-to-end check (a real
// Client ID + real ID token) is pending GOOGLE_OAUTH_CLIENT_ID, per the phase's own note.
describe('AuthService.googleLogin', () => {
  const prisma = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  } as unknown as PrismaService;
  const jwt = { signAsync: jest.fn() } as any;

  let service: AuthService;
  let verifyIdTokenSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.ALLOWED_GOOGLE_HOSTED_DOMAINS = 'uxl.club, other.org';
    service = new AuthService(prisma, jwt);
    verifyIdTokenSpy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');
  });

  afterEach(() => {
    verifyIdTokenSpy.mockRestore();
  });

  function mockPayload(payload: Record<string, unknown>) {
    verifyIdTokenSpy.mockResolvedValue({ getPayload: () => payload } as any);
  }

  it('rejects when email_verified is false', async () => {
    mockPayload({ email_verified: false, hd: 'uxl.club', sub: 'g-1', email: 'a@uxl.club' });
    await expect(service.googleLogin('fake-token')).rejects.toThrow(UnauthorizedException);
    expect((prisma.user.findUnique as jest.Mock)).not.toHaveBeenCalled();
  });

  it('rejects a domain not on the allowlist', async () => {
    mockPayload({ email_verified: true, hd: 'gmail.com', sub: 'g-2', email: 'a@gmail.com' });
    await expect(service.googleLogin('fake-token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a personal account with no hd claim at all', async () => {
    mockPayload({ email_verified: true, sub: 'g-3', email: 'a@gmail.com' });
    await expect(service.googleLogin('fake-token')).rejects.toThrow(UnauthorizedException);
  });

  it('trims/lowercases both sides before comparing the hosted domain', async () => {
    mockPayload({ email_verified: true, hd: 'UXL.Club ', sub: 'g-4', email: 'a@uxl.club' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      empId: 'EMP-00001', email: 'a@uxl.club', role: 'Team Member', team: null,
      firstName: 'A', lastName: 'B', isActive: true,
    });
    (jwt.signAsync as jest.Mock).mockResolvedValue('signed-jwt');
    const result = await service.googleLogin('fake-token');
    expect(result.token).toBe('signed-jwt');
  });
});
