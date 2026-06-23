// 拼课模板存在历史活动类型别名，前端统一用这个守卫识别，避免页面散落字符串判断。
export const COURSE_GROUP_ACTIVITY_TYPE = 'COURSE_GROUP';
export const COURSE_GROUP_BUY_ACTIVITY_TYPE = 'COURSE_GROUP_BUY';

export function isCourseGroupActivityType(type: unknown): boolean {
  const normalized = String(type || '')
    .trim()
    .toUpperCase();
  return normalized === COURSE_GROUP_ACTIVITY_TYPE || normalized === COURSE_GROUP_BUY_ACTIVITY_TYPE;
}
