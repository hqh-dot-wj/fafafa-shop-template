import { Injectable } from '@nestjs/common';
import { CartRepository } from '../../cart/cart.repository';
import { CartService } from '../../cart/cart.service';
import { OrderItemDto } from '../dto/order.dto';
import { ActivityContextTokenService } from 'src/module/marketing/resolution/services/activity-context-token.service';

@Injectable()
export class OrderCartPort {
  constructor(
    private readonly cartRepo: CartRepository,
    private readonly cartService: CartService,
    private readonly tokenService: ActivityContextTokenService,
  ) {}

  async consumeCheckedOutItems(memberId: string, tenantId: string, items: OrderItemDto[]) {
    await this.cartRepo.deleteCheckedOutLines(
      memberId,
      tenantId,
      items.map((item) => ({
        skuId: item.skuId,
        activityContextKey: this.normalizeAndVerifyActivityContextKey(item.activityContextKey, tenantId, memberId),
      })),
    );
  }

  async syncCartToRedis(memberId: string, tenantId: string) {
    await this.cartService.syncCartToRedis(memberId, tenantId);
  }

  private normalizeAndVerifyActivityContextKey(
    value: string | null | undefined,
    tenantId: string,
    memberId: string,
  ): string | null {
    const token = value?.trim();
    if (!token) {
      return null;
    }
    this.tokenService.verify(token, { tenantId, memberId }, { allowAnonymousMember: true });
    return token;
  }
}
