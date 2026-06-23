import { reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { usePickerField } from './use-picker-field';

describe('usePickerField', () => {
  it('应在选择后同步展示名和提交值', () => {
    const model = reactive<{ memberId: string | null }>({ memberId: null });
    const { displayValue, applySelection } = usePickerField({
      model,
      key: 'memberId',
      emptyValue: null,
    });

    applySelection({
      value: 'm-1',
      label: '张三',
    });

    expect(model.memberId).toBe('m-1');
    expect(displayValue.value).toBe('张三');
  });

  it('应支持清空已选内容', () => {
    const model = reactive<{ productId: string }>({ productId: 'p-1' });
    const { displayValue, clearSelection, setDisplayValue } = usePickerField({
      model,
      key: 'productId',
      emptyValue: '',
      initialDisplayValue: '体验课',
    });

    expect(displayValue.value).toBe('体验课');

    setDisplayValue('精品体验课');
    clearSelection();

    expect(model.productId).toBe('');
    expect(displayValue.value).toBe('');
  });
});
