import { vi } from 'vitest'

// @testing-library/dom's `waitFor` só reconhece fake timers via um global `jest`
// (checa `typeof jest !== 'undefined'` e `setTimeout.clock`, que o vi.useFakeTimers
// do Vitest também define). Sem isto, `waitFor` usado junto de `vi.useFakeTimers`
// trava: ele tenta re-verificar a condição via `setInterval`/`MutationObserver`
// reais, que nunca disparam porque os timers estão fakeados.
// Ver: https://github.com/testing-library/dom-testing-library/issues/830
if (typeof (globalThis as Record<string, unknown>).jest === 'undefined') {
  ;(globalThis as unknown as { jest: { advanceTimersByTime: typeof vi.advanceTimersByTime } }).jest = {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  }
}
