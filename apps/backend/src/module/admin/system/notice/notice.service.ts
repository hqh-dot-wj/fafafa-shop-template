import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SysNotice } from '@prisma/client';
import { Result } from 'src/common/response';
import { DelFlagEnum, NoticeTypeEnum, StatusEnum } from 'src/common/enum/index';
import { FormatDateFields } from 'src/common/utils/index';
import { getErrorMessage } from 'src/common/utils/error';
import { CreateNoticeDto, UpdateNoticeDto, ListNoticeDto } from './dto/index';
import { NoticeRepository } from './notice.repository';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { NotificationService } from 'src/module/notification/notification.service';

@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);

  constructor(
    private readonly noticeRepo: NoticeRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async create(createNoticeDto: CreateNoticeDto) {
    const notice = await this.noticeRepo.create(createNoticeDto);
    await this.dispatchNoticeInboxMessage(notice);
    return Result.ok();
  }

  async findAll(query: ListNoticeDto) {
    const where: Prisma.SysNoticeWhereInput = {
      delFlag: DelFlagEnum.NORMAL,
    };

    if (query.noticeTitle) {
      where.noticeTitle = {
        contains: query.noticeTitle,
      };
    }

    if (query.createBy) {
      where.createBy = {
        contains: query.createBy,
      };
    }

    if (query.noticeType) {
      where.noticeType = query.noticeType;
    }

    if (query.params?.beginTime && query.params?.endTime) {
      where.createTime = {
        gte: new Date(query.params.beginTime),
        lte: new Date(query.params.endTime),
      };
    }

    const { list, total } = await this.noticeRepo.findPageWithFilter(where, query.skip, query.take);

    return Result.ok({
      rows: FormatDateFields(list),
      total,
    });
  }

  async findOne(noticeId: number) {
    const data = await this.noticeRepo.findById(noticeId);
    return Result.ok(data);
  }

  async update(updateNoticeDto: UpdateNoticeDto) {
    const previous = await this.noticeRepo.findById(updateNoticeDto.noticeId);
    const notice = await this.noticeRepo.update(updateNoticeDto.noticeId, updateNoticeDto);

    if (previous && !this.shouldSendInboxMessage(previous.status) && this.shouldSendInboxMessage(notice.status)) {
      await this.dispatchNoticeInboxMessage(notice);
    }

    return Result.ok();
  }

  @Transactional()
  async remove(noticeIds: number[]) {
    const data = await this.noticeRepo.softDeleteBatch(noticeIds);
    return Result.ok(data);
  }

  private async dispatchNoticeInboxMessage(notice: SysNotice): Promise<void> {
    if (!this.shouldSendInboxMessage(notice.status)) {
      return;
    }

    const noticeLabel = notice.noticeType === NoticeTypeEnum.ANNOUNCEMENT ? '公告' : '通知';

    try {
      await this.notificationService.send({
        target: notice.tenantId,
        channel: 'IN_APP',
        tenantId: notice.tenantId,
        title: `${noticeLabel}：${notice.noticeTitle}`,
        content: `${noticeLabel}「${notice.noticeTitle}」已发布，请前往通知公告查看。`,
        template: 'NOTICE',
      });
    } catch (error) {
      // 公告表是内容事实源，收件箱投递失败不能反向抹掉已发布公告。
      this.logger.warn(`通知公告站内消息投递失败: noticeId=${notice.noticeId}, error=${getErrorMessage(error)}`);
    }
  }

  private shouldSendInboxMessage(status?: unknown): boolean {
    return status === undefined || status === StatusEnum.NORMAL || status === '0';
  }
}
