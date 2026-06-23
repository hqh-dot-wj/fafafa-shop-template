/**
 * 服务预约 API
 * 类型来自 @libs/common-types（由 backend openApi.json 生成）
 */
import type { components } from '@libs/common-types';
import { httpGet, httpPost } from '@/http/http';

export type DateVo = components['schemas']['DateVo'];
export type TimeSlotVo = components['schemas']['TimeSlotVo'];
export type AvailableDatesResult = components['schemas']['AvailableDatesVo'];
export type TimeSlotsResult = components['schemas']['TimeSlotsVo'];

/**
 * 获取可预约日期
 */
export function getAvailableDates() {
  return httpGet<AvailableDatesResult>('/client/service/available-dates');
}

/**
 * 获取可用时间段
 */
export function getTimeSlots(date: string) {
  return httpGet<TimeSlotsResult>('/client/service/time-slots', { date });
}

/**
 * 锁定时间段
 */
export function lockSlot(date: string, time: string) {
  return httpPost('/client/service/lock-slot', { date, time });
}
