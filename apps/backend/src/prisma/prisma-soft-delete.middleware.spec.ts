import { DelFlag } from '@prisma/client';
import { createSoftDeleteMiddleware } from './prisma-soft-delete.middleware';

describe('createSoftDeleteMiddleware', () => {
  const mw = createSoftDeleteMiddleware();

  it('非 delete 操作原样传递', async () => {
    const params = {
      action: 'findMany',
      model: 'OmsOrder',
      args: {},
    } as Parameters<typeof mw>[0];
    const next = jest.fn().mockResolvedValue([]);
    await mw(params, next);
    expect(params.action).toBe('findMany');
    expect(next).toHaveBeenCalledWith(params);
  });

  it('OmsOrder delete 改为 update 并写入 delFlag 与 deleteTime 审计', async () => {
    const params = {
      action: 'delete',
      model: 'OmsOrder',
      args: { where: { id: 'ord_1' } },
    } as Parameters<typeof mw>[0];
    const next = jest.fn().mockResolvedValue({});
    await mw(params, next);
    expect(params.action).toBe('update');
    const data = (params.args as { data: { deleteTime: Date; delFlag: DelFlag } }).data;
    expect(data.delFlag).toBe(DelFlag.DELETE);
    expect(data.deleteTime).toBeInstanceOf(Date);
    expect(next).toHaveBeenCalledWith(params);
  });

  it('SysMessage 保留物理 delete', async () => {
    const params = {
      action: 'delete',
      model: 'SysMessage',
      args: { where: { id: 1 } },
    } as Parameters<typeof mw>[0];
    const next = jest.fn().mockResolvedValue({});
    await mw(params, next);
    expect(params.action).toBe('delete');
    expect(next).toHaveBeenCalledWith(params);
  });

  it('无 delFlag 的模型 delete 保留物理删除', async () => {
    const params = {
      action: 'delete',
      model: 'UmsMember',
      args: { where: { memberId: 'm1' } },
    } as Parameters<typeof mw>[0];
    const next = jest.fn().mockResolvedValue({});
    await mw(params, next);
    expect(params.action).toBe('delete');
    expect(next).toHaveBeenCalledWith(params);
  });

  it('带 delFlag 的模型 delete 改为 delFlag DELETE', async () => {
    const params = {
      action: 'delete',
      model: 'GenTable',
      args: { where: { tableId: 9 } },
    } as Parameters<typeof mw>[0];
    const next = jest.fn().mockResolvedValue({});
    await mw(params, next);
    expect(params.action).toBe('update');
    expect((params.args as { data: { delFlag: DelFlag } }).data.delFlag).toBe(DelFlag.DELETE);
    expect(next).toHaveBeenCalledWith(params);
  });

  it('OmsOrder deleteMany 改为 updateMany 并写入 delFlag 与 deleteTime 审计', async () => {
    const params = {
      action: 'deleteMany',
      model: 'OmsOrder',
      args: { where: { memberId: { in: ['m1'] } } },
    } as Parameters<typeof mw>[0];
    const next = jest.fn().mockResolvedValue({ count: 2 });
    await mw(params, next);
    expect(params.action).toBe('updateMany');
    const data = (params.args as { data: { deleteTime: Date; delFlag: DelFlag } }).data;
    expect(data.delFlag).toBe(DelFlag.DELETE);
    expect(data.deleteTime).toBeInstanceOf(Date);
    expect(next).toHaveBeenCalledWith(params);
  });

  it('SysMessage deleteMany 保留物理删除', async () => {
    const params = {
      action: 'deleteMany',
      model: 'SysMessage',
      args: { where: { receiverId: 'x' } },
    } as Parameters<typeof mw>[0];
    const next = jest.fn().mockResolvedValue({ count: 0 });
    await mw(params, next);
    expect(params.action).toBe('deleteMany');
    expect(next).toHaveBeenCalledWith(params);
  });

  it('无 delFlag 的模型 deleteMany 保留物理删除', async () => {
    const params = {
      action: 'deleteMany',
      model: 'UmsMember',
      args: { where: { memberId: { in: ['m1', 'm2'] } } },
    } as Parameters<typeof mw>[0];
    const next = jest.fn().mockResolvedValue({ count: 2 });
    await mw(params, next);
    expect(params.action).toBe('deleteMany');
    expect(next).toHaveBeenCalledWith(params);
  });

  it('带 delFlag 的模型 deleteMany 改为 updateMany delFlag DELETE', async () => {
    const params = {
      action: 'deleteMany',
      model: 'SysUpload',
      args: { where: { uploadId: { in: ['a', 'b'] } } },
    } as Parameters<typeof mw>[0];
    const next = jest.fn().mockResolvedValue({ count: 2 });
    await mw(params, next);
    expect(params.action).toBe('updateMany');
    expect((params.args as { data: { delFlag: DelFlag } }).data.delFlag).toBe(DelFlag.DELETE);
    expect(next).toHaveBeenCalledWith(params);
  });
});
