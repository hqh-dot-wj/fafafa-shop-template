import { BusinessException } from 'src/common/exceptions';
import { AppConfigService } from 'src/config/app-config.service';
import { UploadService } from 'src/module/admin/upload/upload.service';
import { ClientUploadController } from './client-upload.controller';

describe('ClientUploadController', () => {
  it('未选择文件时应拒绝', async () => {
    const controller = new ClientUploadController(
      { singleFileUpload: jest.fn() } as unknown as UploadService,
      { app: { file: { domain: 'http://localhost:8080' } } } as unknown as AppConfigService,
    );
    await expect(controller.upload(undefined as unknown as Express.Multer.File)).rejects.toBeInstanceOf(
      BusinessException,
    );
  });
});
