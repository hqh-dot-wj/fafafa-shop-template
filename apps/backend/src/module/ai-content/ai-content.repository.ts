import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseRepository } from 'src/common/repository/base.repository';
import { AiContentRecord, Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AiContentRepository extends BaseRepository<AiContentRecord, Prisma.AiContentRecordCreateInput> {
  constructor(prisma: PrismaService, cls: ClsService) {
    super(prisma, cls, 'aiContentRecord');
  }

  /**
   * 统计指定会员当天的生成次数
   *
   * @param memberId - 会员 ID
   * @returns 当天已生成次数
   */
  async countTodayByMember(memberId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.count({
      memberId,
      createTime: { gte: today },
    });
  }

  /**
   * 分页查询会员的生成历史，按创建时间倒序
   *
   * @param memberId - 会员 ID
   * @param pageNum - 页码
   * @param pageSize - 每页条数
   * @returns 分页结果
   */
  async findHistoryPage(memberId: string, pageNum: number = 1, pageSize: number = 10) {
    return this.findPage({
      pageNum,
      pageSize,
      where: { memberId },
      orderBy: 'createTime',
      order: 'desc',
    });
  }
}
