import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 无 token / token 无效时的游客上下文，与 member-jwt 成功态字段对齐 */
export const GUEST_MEMBER_USER = {
  memberId: '',
  platform: 'MP_MALL',
} as const;

/**
 * 可选会员鉴权：有合法 access token 则解析会员；否则按游客放行（memberId 为空）。
 * 仅用于商品/场景/导航等浏览类 C 端接口；写操作与资产类接口仍用 MemberAuthGuard。
 */
@Injectable()
export class OptionalMemberAuthGuard extends AuthGuard('member-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser = typeof GUEST_MEMBER_USER>(_err: Error | null, user: TUser | false): TUser {
    if (user) {
      return user;
    }
    return GUEST_MEMBER_USER as TUser;
  }
}
