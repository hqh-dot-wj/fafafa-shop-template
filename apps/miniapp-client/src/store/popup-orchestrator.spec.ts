import { describe, expect, it } from 'vitest';
import { createPopupOrchestrator } from './popup-orchestrator';

describe('popup-orchestrator', () => {
  it('协议优先于地址和登录', () => {
    const o = createPopupOrchestrator();
    o.enqueue('login');
    o.enqueue('address');
    o.enqueue('agreement');
    expect(o.next()).toEqual({ kind: 'agreement' });
    expect(o.next()).toEqual({ kind: 'address' });
    expect(o.next()).toEqual({ kind: 'login' });
    expect(o.next()).toBeUndefined();
  });

  it('同优先级按入队顺序出队', () => {
    const o = createPopupOrchestrator();
    o.enqueue('login', { resumeAction: 'a' });
    o.enqueue('login', { resumeAction: 'b' });
    expect(o.next()).toEqual({ kind: 'login', resumeAction: 'a' });
    expect(o.next()).toEqual({ kind: 'login', resumeAction: 'b' });
  });

  it('submitOrder 场景下地址项携带 resumeAction', () => {
    const o = createPopupOrchestrator();
    o.enqueue('address', { resumeAction: 'submitOrder' });
    expect(o.next()).toEqual({ kind: 'address', resumeAction: 'submitOrder' });
  });

  it('buyNow 在队列中先于 login 出队（地址优先于登录）', () => {
    const o = createPopupOrchestrator();
    o.enqueue('login');
    o.enqueue('address', { resumeAction: 'buyNow' });
    expect(o.next()?.kind).toBe('address');
    expect(o.next()?.kind).toBe('login');
  });
});
