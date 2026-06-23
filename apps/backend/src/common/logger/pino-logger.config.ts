import { Params } from 'nestjs-pino';
import { TenantContext } from '../tenant';
import { getErrorMessage, getErrorStack } from '../utils/error';
import * as path from 'path';
import * as fs from 'fs';
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';

type HeaderValue = string | string[] | undefined;
type LogPayload = object | string | number | boolean | null | undefined;

type PrettyTransport = {
  target: 'pino-pretty';
  level?: string;
  options: {
    colorize: boolean;
    translateTime: string;
    ignore: string;
    singleLine: boolean;
  };
};

type FileTransport = {
  target: 'pino/file';
  level?: string;
  options: {
    destination: string;
    mkdir: boolean;
  };
};

type MultiTransport = {
  targets: Array<PrettyTransport | FileTransport>;
};

type PinoTransport = PrettyTransport | FileTransport | MultiTransport | undefined;

interface PinoUserContext {
  userId?: string | number;
  userName?: string;
  user?: PinoUserContext;
}

interface PinoRequestLike {
  id?: string | number;
  traceId?: string;
  ip?: string;
  method?: string;
  url?: string;
  query?: object;
  params?: object;
  raw?: {
    body?: LogPayload;
  };
  headers: IncomingHttpHeaders;
  user?: PinoUserContext;
}

interface PinoError extends Error {
  code?: string | number;
  status?: number;
  response?: LogPayload;
}

const getHeaderValue = (value: HeaderValue): string | undefined => {
  return Array.isArray(value) ? value[0] : value;
};

const normalizePathname = (url: string | undefined): string => {
  if (!url) return '';
  return url.split('?')[0] ?? '';
};

const isHighFrequencyPath = (url: string | undefined): boolean => {
  const pathname = normalizePathname(url);
  return pathname.endsWith('/client/product/list') || pathname.endsWith('/client/product/list/');
};

export function createPinoConfig(
  logDir: string,
  level: string,
  prettyPrint: boolean,
  toFile: boolean,
  excludePaths: string[],
  sensitiveFields: string[],
): Params {
  const env = process.env.NODE_ENV || 'development';

  if (toFile) {
    const absoluteLogDir = path.isAbsolute(logDir) ? logDir : path.resolve(process.cwd(), logDir);

    if (!fs.existsSync(absoluteLogDir)) {
      fs.mkdirSync(absoluteLogDir, { recursive: true });
    }
  }

  const redactPaths = sensitiveFields.flatMap((field) => [
    `req.body.${field}`,
    `req.query.${field}`,
    `req.headers.${field}`,
    `*.${field}`,
    `**.${field}`,
  ]);

  let transport: PinoTransport;

  if (prettyPrint && toFile) {
    const absoluteLogDir = path.isAbsolute(logDir) ? logDir : path.resolve(process.cwd(), logDir);

    transport = {
      targets: [
        {
          target: 'pino-pretty',
          level,
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
        {
          target: 'pino/file',
          level,
          options: {
            destination: path.join(absoluteLogDir, `app-${env}-${new Date().toISOString().split('T')[0]}.log`),
            mkdir: true,
          },
        },
      ],
    };
  } else if (prettyPrint) {
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    };
  } else if (toFile) {
    const absoluteLogDir = path.isAbsolute(logDir) ? logDir : path.resolve(process.cwd(), logDir);

    transport = {
      target: 'pino/file',
      options: {
        destination: path.join(absoluteLogDir, `app-${env}-${new Date().toISOString().split('T')[0]}.log`),
        mkdir: true,
      },
    };
  }

  return {
    pinoHttp: {
      level,
      redact: {
        paths: redactPaths,
        censor: '***REDACTED***',
      },
      transport,

      ...(!prettyPrint && {
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
      }),

      customProps: (req: IncomingMessage, _res: ServerResponse) => {
        const request = req as IncomingMessage & PinoRequestLike;
        const user = request.user;

        return {
          requestId: request.id,
          traceId: request.traceId || getHeaderValue(request.headers['x-trace-id']),
          tenantId: TenantContext.getTenantId() || 'n/a',
          userId: user?.user?.userId || user?.userId,
          username: user?.user?.userName || user?.userName || 'anonymous',
          userAgent: getHeaderValue(request.headers['user-agent']),
          ip: request.ip || '',
        };
      },

      serializers: {
        req(req) {
          const request = req as PinoRequestLike;
          return {
            id: request.id,
            method: request.method,
            url: request.url,
            query: request.query,
            params: request.params,
            body: request.raw?.body,
            headers: {
              host: getHeaderValue(request.headers.host),
              'content-type': getHeaderValue(request.headers['content-type']),
              'user-agent': getHeaderValue(request.headers['user-agent']),
              referer: getHeaderValue(request.headers.referer),
              'x-tenant-id': getHeaderValue(request.headers['x-tenant-id']),
              'x-request-id': getHeaderValue(request.headers['x-request-id']),
              'x-trace-id': getHeaderValue(request.headers['x-trace-id']),
              'x-encrypted': getHeaderValue(request.headers['x-encrypted']),
            },
          };
        },
        res(res) {
          const response = res as ServerResponse;
          return {
            statusCode: response.statusCode,
            headers: response.getHeaders
              ? {
                  'content-type': response.getHeader('content-type'),
                  'content-length': response.getHeader('content-length'),
                }
              : {},
          };
        },
        err(err) {
          const error = err as PinoError;
          return {
            type: error.constructor.name,
            message: getErrorMessage(error),
            stack: env === 'development' ? getErrorStack(error) : undefined,
            code: error.code,
            ...(error.response !== undefined && { response: error.response }),
            ...(error.status !== undefined && { status: error.status }),
          };
        },
      },

      customLogLevel: function (req, res, err) {
        if (res.statusCode >= 500 || err) {
          return 'error';
        } else if (res.statusCode >= 400) {
          return 'warn';
        }

        // 商品列表高并发场景下，成功访问日志降级到 debug，避免日志 IO 挤占吞吐。
        if (isHighFrequencyPath(req.url)) {
          return 'debug';
        }

        return 'info';
      },

      customSuccessMessage: function (req, res) {
        if (res.statusCode === 404) {
          return 'Resource not found';
        }
        return `${req.method} ${req.url} completed`;
      },

      customErrorMessage: function (req, res, err) {
        return `${req.method} ${req.url} failed: ${getErrorMessage(err)}`;
      },

      autoLogging: {
        ignore: (req) => {
          return excludePaths.some((item) => req.url?.startsWith(item));
        },
      },
    },
  };
}
