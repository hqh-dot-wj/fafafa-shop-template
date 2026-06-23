import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { ActivityContextTokenService } from '../services/activity-context-token.service';
import { decodeBase64Url, encodeBase64Url } from '../services/token-codec.util';

const OLD_ENV = process.env;
const PRIMARY = 'primary_marketing_activity_token_secret_32_chars';
const ROTATED_PRIMARY = 'rotated_marketing_activity_token_secret_32_chars';

describe('ActivityContextTokenService', () => {
  let service: ActivityContextTokenService;

  beforeEach(() => {
    jest.useRealTimers();
    process.env = { ...OLD_ENV };
    process.env.MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY = PRIMARY;
    delete process.env.MARKETING_ACTIVITY_TOKEN_SECRET_SECONDARY;
    delete process.env.MARKETING_ACTIVITY_TOKEN_TTL_SECONDS;
    service = new ActivityContextTokenService();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('issues and verifies signed activity context metadata', () => {
    const token = service.issue({
      tenantId: 'tenant-1',
      memberId: 'member-1',
      activityType: 'COURSE_GROUP_BUY',
      activityConfigId: 'cfg-1',
      activityVersionId: 'activity-v1',
      entrySceneCode: 'HOME',
      entryModuleCode: 'M1',
      cardTemplateCode: 'CARD_A',
      resolverPolicyCode: 'RES_A',
      resolverReleaseNo: 12,
      attributionWindowMinutes: 4320,
      shareChannel: 'POSTER',
    });

    expect(token).not.toContain('COURSE_GROUP_BUY:cfg-1');
    expect(service.verify(token, { tenantId: 'tenant-1', memberId: 'member-1' })).toMatchObject({
      tenantId: 'tenant-1',
      memberId: 'member-1',
      activityType: 'COURSE_GROUP_BUY',
      activityConfigId: 'cfg-1',
      activityVersionId: 'activity-v1',
      entrySceneCode: 'HOME',
      entryModuleCode: 'M1',
      cardTemplateCode: 'CARD_A',
      resolverPolicyCode: 'RES_A',
      resolverReleaseNo: 12,
      attributionWindowMinutes: 4320,
      shareChannel: 'POSTER',
      signedWith: '1',
    });
  });

  it('rejects a token when payload is tampered', () => {
    const token = service.issue({
      tenantId: 'tenant-1',
      memberId: 'member-1',
      activityType: 'FLASH',
      activityConfigId: 'cfg-1',
    });
    const [payloadB64, kid, sig] = token.split('.');
    const payload = JSON.parse(decodeBase64Url(payloadB64));
    payload.cid = 'cfg-tampered';
    const tampered = `${encodeBase64Url(JSON.stringify(payload))}.${kid}.${sig}`;

    expect(() => service.verify(tampered, { tenantId: 'tenant-1', memberId: 'member-1' })).toThrow(BusinessException);
    try {
      service.verify(tampered, { tenantId: 'tenant-1', memberId: 'member-1' });
    } catch (error) {
      expect((error as BusinessException).errorCode).toBe(ResponseCode.TOKEN_INVALID);
    }
  });

  it('rejects expired tokens', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T00:00:00.000Z'));
    const token = service.issue({
      tenantId: 'tenant-1',
      memberId: 'member-1',
      activityType: 'FLASH',
      activityConfigId: 'cfg-1',
      ttlSeconds: 1,
    });
    jest.setSystemTime(new Date('2026-05-15T00:00:02.000Z'));

    try {
      service.verify(token, { tenantId: 'tenant-1', memberId: 'member-1' });
    } catch (error) {
      expect((error as BusinessException).errorCode).toBe(ResponseCode.TOKEN_EXPIRED);
      return;
    }
    throw new Error('expected token to expire');
  });

  it('rejects tenant and member mismatch', () => {
    const token = service.issue({
      tenantId: 'tenant-1',
      memberId: 'member-1',
      activityType: 'FLASH',
      activityConfigId: 'cfg-1',
    });

    expect(() => service.verify(token, { tenantId: 'tenant-2', memberId: 'member-1' })).toThrow(BusinessException);
    expect(() => service.verify(token, { tenantId: 'tenant-1', memberId: 'member-2' })).toThrow(BusinessException);
  });

  it('accepts old primary through secondary during key rotation', () => {
    const token = service.issue({
      tenantId: 'tenant-1',
      memberId: 'member-1',
      activityType: 'FLASH',
      activityConfigId: 'cfg-1',
    });

    process.env.MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY = ROTATED_PRIMARY;
    process.env.MARKETING_ACTIVITY_TOKEN_SECRET_SECONDARY = PRIMARY;
    expect(service.verify(token, { tenantId: 'tenant-1', memberId: 'member-1' }).signedWith).toBe('2');

    delete process.env.MARKETING_ACTIVITY_TOKEN_SECRET_SECONDARY;
    expect(() => service.verify(token, { tenantId: 'tenant-1', memberId: 'member-1' })).toThrow(BusinessException);
  });

  it('allows anonymous display tokens to be accepted only when explicitly allowed', () => {
    const token = service.issue({
      tenantId: 'tenant-1',
      memberId: null,
      activityType: 'FLASH',
      activityConfigId: 'cfg-1',
    });

    expect(() => service.verify(token, { tenantId: 'tenant-1', memberId: 'member-1' })).toThrow(BusinessException);
    expect(
      service.verify(token, { tenantId: 'tenant-1', memberId: 'member-1' }, { allowAnonymousMember: true }),
    ).toMatchObject({ memberId: null, activityConfigId: 'cfg-1' });
  });
});
