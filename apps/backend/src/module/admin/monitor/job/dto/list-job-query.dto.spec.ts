import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListJobDto, ListJobLogDto } from './create-job.dto';

describe('定时任务列表查询 DTO', () => {
  it('ListJobLogDto：空字符串 jobName/jobGroup 应通过校验（前端常传 query 空值）', async () => {
    const dto = plainToInstance(ListJobLogDto, {
      pageNum: '1',
      pageSize: '5',
      status: '1',
      jobName: '',
      jobGroup: '',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('ListJobDto：空字符串 jobGroup 应通过校验', async () => {
    const dto = plainToInstance(ListJobDto, {
      pageNum: '1',
      pageSize: '10',
      jobName: '',
      jobGroup: '',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
