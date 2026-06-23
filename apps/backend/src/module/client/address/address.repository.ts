import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/repository/base.repository';
import { UmsAddress, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AddressRepository extends BaseRepository<UmsAddress, Prisma.UmsAddressUncheckedCreateInput> {
  constructor(
    prisma: PrismaService,
    private readonly clsService: ClsService,
  ) {
    super(prisma, clsService, 'umsAddress', 'id', '');
  }

  /**
   * 获取用户默认地址
   */
  async findDefault(memberId: string) {
    return this.delegate.findFirst({
      where: this.scopeReadWhere({ memberId, isDefault: true }),
    });
  }

  /**
   * 获取用户第一个地址（按创建时间倒序）
   */
  async findFirst(where: Prisma.UmsAddressWhereInput): Promise<UmsAddress | null> {
    return this.delegate.findFirst({
      where: this.scopeReadWhere(where as object),
      orderBy: { createTime: 'desc' },
    });
  }

  /**
   * 统计用户地址数量
   */
  async countByMember(memberId: string) {
    return this.delegate.count({
      where: this.scopeReadWhere({ memberId }),
    });
  }

  /**
   * 清除用户默认地址
   */
  async clearDefault(memberId: string) {
    return this.prisma.umsAddress.updateMany({
      where: { memberId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
