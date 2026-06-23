import ActivityPoolPicker from './widgets/ActivityPoolPicker.vue';
import CouponPicker from './widgets/CouponPicker.vue';
import MemberFilterEditor from './widgets/MemberFilterEditor.vue';
import ProductPicker from './widgets/ProductPicker.vue';
import ScheduleEditor from './widgets/ScheduleEditor.vue';
import StorePicker from './widgets/StorePicker.vue';
import TimeBoxPicker from './widgets/TimeBoxPicker.vue';
import TimeRangePicker from './widgets/TimeRangePicker.vue';

export const WIDGET_REGISTRY = {
  ProductPicker,
  StorePicker,
  TimeRangePicker,
  TimeBoxPicker,
  ScheduleEditor,
  MemberFilterEditor,
  CouponPicker,
  ActivityPoolPicker,
} as const;

export type RegisteredWidgetName = keyof typeof WIDGET_REGISTRY;

export function getRegisteredWidget(name?: string) {
  if (!name) return null;
  return WIDGET_REGISTRY[name as RegisteredWidgetName] ?? null;
}
