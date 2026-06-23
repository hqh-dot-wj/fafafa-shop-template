/**
 * 拦截 touchmove 穿透（如底层页面滚动）。
 * 仅在 cancelable 为 true 时 preventDefault，避免 Chrome「Ignored attempt to cancel a touchmove…」告警。
 */
export function absorbTouchMove(e: Event): void {
  e.stopPropagation();
  if (e.cancelable) {
    e.preventDefault();
  }
}
