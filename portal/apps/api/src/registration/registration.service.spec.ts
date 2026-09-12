import { RegistrationService } from './registration.service';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { GoogleVerifyService } from '../auth/google-verify.service';
import { EmailService } from '../email/email.service';

// The real end-to-end Google-assisted registration check is pending a real
// GOOGLE_OAUTH_CLIENT_ID (same as Phase 3) -- stub GoogleVerifyService.verify() here to
// prove the linking logic itself: a valid token's sub/email land on googleSub/googleEmail,
// and a password is still required regardless.
describe('RegistrationService.submitRegistration — Google-assisted path', () => {
  const prisma = {
    user: { findFirst: jest.fn() },
    registrationRequest: { findFirst: jest.fn(), create: jest.fn() },
    idCounter: { upsert: jest.fn() },
  } as unknown as PrismaService;
  const idUtils = new IdUtilsService(prisma);
  const googleVerify = { verify: jest.fn() } as unknown as GoogleVerifyService;
  const email = { sendRegistrationApproved: jest.fn(), sendRegistrationRejected: jest.fn() } as unknown as EmailService;

  let service: RegistrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RegistrationService(prisma, idUtils, googleVerify, email);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null); // no existing user/manual-manager
    (prisma.registrationRequest.findFirst as jest.Mock).mockResolvedValue(null); // no pending dup
    (prisma.idCounter.upsert as jest.Mock).mockResolvedValue({ prefix: 'REG', nextValue: 2 });
    (prisma.registrationRequest.create as jest.Mock).mockResolvedValue({});
  });

  it('links a verified Google identity onto the new request', async () => {
    (googleVerify.verify as jest.Mock).mockResolvedValue({
      sub: 'google-sub-123',
      email: 'applicant@uxl.club',
    });

    const result = await service.submitRegistration({
      firstName: 'A',
      lastName: 'B',
      email: 'applicant@uxl.club',
      password: 'Test1234',
      googleIdToken: 'valid-token',
    } as any);

    expect(result.reqId).toBe('REG-00001');
    expect(prisma.registrationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          googleSub: 'google-sub-123',
          googleEmail: 'applicant@uxl.club',
        }),
      }),
    );
  });

  it('proceeds as a manual registration when the token is invalid, without failing the submission', async () => {
    (googleVerify.verify as jest.Mock).mockRejectedValue(new Error('bad token'));

    const result = await service.submitRegistration({
      firstName: 'A',
      lastName: 'B',
      email: 'applicant2@uxl.club',
      password: 'Test1234',
      googleIdToken: 'garbage',
    } as any);

    expect(result.reqId).toBe('REG-00001');
    expect(prisma.registrationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ googleSub: undefined, googleEmail: undefined }),
      }),
    );
  });
});
