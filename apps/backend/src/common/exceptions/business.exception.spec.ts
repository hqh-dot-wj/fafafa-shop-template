import { HttpStatus } from '@nestjs/common';
import {
  BusinessException,
  AuthenticationException,
  AuthorizationException,
  ValidationException,
  NotFoundException,
} from './business.exception';
import { ResponseCode } from '../response/response.interface';

describe('BusinessException', () => {
  describe('constructor', () => {
    it('Given code 和 message, When new BusinessException, Then 设置正确属性', () => {
      const ex = new BusinessException(ResponseCode.BUSINESS_ERROR, '操作失败');

      expect(ex.errorCode).toBe(ResponseCode.BUSINESS_ERROR);
      expect(ex.getStatus()).toBe(HttpStatus.OK);
      const response = ex.getResponse() as any;
      expect(response.code).toBe(ResponseCode.BUSINESS_ERROR);
      expect(response.msg).toBe('操作失败');
    });

    it('Given 仅 code, When new BusinessException, Then 使用默认消息', () => {
      const ex = new BusinessException(ResponseCode.BUSINESS_ERROR);
      const response = ex.getResponse() as any;
      expect(response.msg).toBeDefined();
    });

    it('Given 携带 data, When new BusinessException, Then data 可访问', () => {
      const ex = new BusinessException(ResponseCode.BUSINESS_ERROR, '错误', { count: 5 });
      expect(ex.errorData).toEqual({ count: 5 });
      const response = ex.getResponse() as any;
      expect(response.data).toEqual({ count: 5 });
    });
  });

  describe('throwIf', () => {
    it('Given condition=true, When throwIf, Then 抛出 BusinessException', () => {
      expect(() => BusinessException.throwIf(true, '条件满足')).toThrow(BusinessException);
    });

    it('Given condition=false, When throwIf, Then 不抛出异常', () => {
      expect(() => BusinessException.throwIf(false, '条件不满足')).not.toThrow();
    });

    it('Given 自定义 code, When throwIf, Then 使用自定义 code', () => {
      try {
        BusinessException.throwIf(true, '参数错误', ResponseCode.PARAM_INVALID);
      } catch (e) {
        expect((e as BusinessException).errorCode).toBe(ResponseCode.PARAM_INVALID);
      }
    });
  });

  describe('throwIfNull', () => {
    it('Given null, When throwIfNull, Then 抛出 BusinessException', () => {
      expect(() => BusinessException.throwIfNull(null, '数据不存在')).toThrow(BusinessException);
    });

    it('Given undefined, When throwIfNull, Then 抛出 BusinessException', () => {
      expect(() => BusinessException.throwIfNull(undefined, '数据不存在')).toThrow(BusinessException);
    });

    it('Given 有效值, When throwIfNull, Then 不抛出异常', () => {
      expect(() => BusinessException.throwIfNull({ id: 1 })).not.toThrow();
    });

    it('Given 0, When throwIfNull, Then 不抛出异常（0 是有效值）', () => {
      expect(() => BusinessException.throwIfNull(0)).not.toThrow();
    });

    it('Given 空字符串, When throwIfNull, Then 不抛出异常', () => {
      expect(() => BusinessException.throwIfNull('')).not.toThrow();
    });
  });

  describe('throwIfEmpty', () => {
    it('Given 空数组, When throwIfEmpty, Then 抛出 BusinessException', () => {
      expect(() => BusinessException.throwIfEmpty([])).toThrow(BusinessException);
    });

    it('Given null, When throwIfEmpty, Then 抛出 BusinessException', () => {
      expect(() => BusinessException.throwIfEmpty(null as any)).toThrow(BusinessException);
    });

    it('Given 非空数组, When throwIfEmpty, Then 不抛出异常', () => {
      expect(() => BusinessException.throwIfEmpty([1, 2])).not.toThrow();
    });
  });

  describe('static throw', () => {
    it('Given code 和 message, When BusinessException.throw, Then 抛出异常', () => {
      expect(() => BusinessException.throw(ResponseCode.BUSINESS_ERROR, '失败')).toThrow(BusinessException);
    });
  });
});

describe('AuthenticationException', () => {
  it('Given 默认参数, When new AuthenticationException, Then 返回 401', () => {
    const ex = new AuthenticationException();
    expect(ex.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('Given 自定义消息, When new AuthenticationException, Then 使用自定义消息', () => {
    const ex = new AuthenticationException(ResponseCode.UNAUTHORIZED, 'Token 过期');
    const response = ex.getResponse() as any;
    expect(response.msg).toBe('Token 过期');
  });

  it('Given 调用 static throw, When AuthenticationException.throw, Then 抛出异常', () => {
    expect(() => AuthenticationException.throw(ResponseCode.UNAUTHORIZED)).toThrow(AuthenticationException);
  });
});

describe('AuthorizationException', () => {
  it('Given 默认参数, When new AuthorizationException, Then 返回 403', () => {
    const ex = new AuthorizationException();
    expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
  });

  it('Given 调用 static throw, When AuthorizationException.throw, Then 抛出异常', () => {
    expect(() => AuthorizationException.throw(ResponseCode.FORBIDDEN)).toThrow(AuthorizationException);
  });
});

describe('ValidationException', () => {
  it('Given 单个错误字符串, When new ValidationException, Then 返回 400', () => {
    const ex = new ValidationException('字段不能为空');
    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    const response = ex.getResponse() as any;
    expect(response.msg).toBe('字段不能为空');
  });

  it('Given 错误数组, When new ValidationException, Then 第一个错误作为 msg', () => {
    const ex = new ValidationException(['字段A不能为空', '字段B格式错误']);
    const response = ex.getResponse() as any;
    expect(response.msg).toBe('字段A不能为空');
    expect(response.data.errors).toHaveLength(2);
  });

  it('Given 单元素数组, When new ValidationException, Then data 为 null', () => {
    const ex = new ValidationException(['唯一错误']);
    const response = ex.getResponse() as any;
    expect(response.data).toBeNull();
  });
});

describe('NotFoundException', () => {
  it('Given 默认参数, When new NotFoundException, Then 返回 404 和默认消息', () => {
    const ex = new NotFoundException();
    expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
    const response = ex.getResponse() as any;
    expect(response.msg).toBe('资源不存在');
  });

  it('Given 自定义资源名, When new NotFoundException, Then 消息包含资源名', () => {
    const ex = new NotFoundException('用户');
    const response = ex.getResponse() as any;
    expect(response.msg).toBe('用户不存在');
  });
});
