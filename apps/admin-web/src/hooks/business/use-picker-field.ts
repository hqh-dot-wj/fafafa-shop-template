import { ref } from 'vue';

interface UsePickerFieldOptions<T extends Record<string, unknown>, K extends keyof T> {
  model: T;
  key: K;
  emptyValue: T[K];
  initialDisplayValue?: string;
}

interface PickerFieldSelection<T> {
  value: T;
  label: string;
}

export function usePickerField<T extends Record<string, unknown>, K extends keyof T>(
  options: UsePickerFieldOptions<T, K>,
) {
  const displayValue = ref(options.initialDisplayValue ?? '');

  function applySelection(selection: PickerFieldSelection<T[K]>) {
    options.model[options.key] = selection.value;
    displayValue.value = selection.label;
  }

  function setDisplayValue(label: string) {
    displayValue.value = label;
  }

  function clearSelection() {
    options.model[options.key] = options.emptyValue;
    displayValue.value = '';
  }

  return {
    displayValue,
    applySelection,
    setDisplayValue,
    clearSelection,
  };
}
