import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { CryptoService } from './crypto.service';
import { SKIP_DECRYPT_KEY } from './crypto.decorator';
import { Request } from 'express';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';

type DecryptInterceptorValue = object | string | number | boolean | null | undefined;
type RequestPayload = object | string | number | boolean | null;
interface EncryptedRequestBody {
  encryptedKey?: string;
  encryptedData?: string;
}

@Injectable()
export class DecryptInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DecryptInterceptor.name);

  constructor(
    private cryptoService: CryptoService,
    private reflector: Reflector,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<DecryptInterceptorValue>,
  ): Observable<DecryptInterceptorValue> {
    if (!this.cryptoService.isEnabled()) {
      return next.handle();
    }

    const skipDecrypt = this.reflector.getAllAndOverride<boolean>(SKIP_DECRYPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipDecrypt) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { body: RequestPayload }>();

    const encryptedHeader = request.headers['x-encrypted'];
    const isEncrypted =
      encryptedHeader === 'true' || (Array.isArray(encryptedHeader) && encryptedHeader.includes('true'));

    if (!isEncrypted || !request.body) {
      return next.handle();
    }

    try {
      const payload =
        typeof request.body === 'object' && request.body !== null ? (request.body as EncryptedRequestBody) : null;

      if (payload?.encryptedKey && payload?.encryptedData) {
        const decryptedBody = this.cryptoService.decryptRequest(payload.encryptedKey, payload.encryptedData);
        request.body = decryptedBody;

        this.logger.log(`Request body decrypted successfully: ${JSON.stringify(decryptedBody)}`);
      }
    } catch (error) {
      this.logger.error('Failed to decrypt request body:', getErrorMessage(error));
      this.logger.error('Error stack:', getErrorStack(error));
    }

    return next.handle();
  }
}
