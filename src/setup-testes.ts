import '@testing-library/jest-dom/vitest'

// Node 25 expõe um `localStorage` global proprio (stub vazio) que sombreia o `Storage`
// do jsdom, porque no ambiente jsdom do vitest `globalThis === window`. Sem isso os testes
// de persistencia falham com `localStorage.removeItem is not a function`. Isto afeta apenas
// testes — a app roda num navegador real com um `Storage` real.
if (!localStorage || typeof localStorage.removeItem !== 'function') {
  const store = Object.create(null) as Record<string, string>
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
      setItem: (key: string, value: string) => {
        store[String(key)] = String(value)
      },
      removeItem: (key: string) => {
        delete store[String(key)]
      },
      clear: () => {
        Object.keys(store).forEach(key => delete store[key])
      },
      key: (index: number) => Object.keys(store)[index] || null,
      get length() {
        return Object.keys(store).length
      },
    },
  })
}
