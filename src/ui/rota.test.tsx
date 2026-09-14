import { describe, it, expect } from 'vitest'
import { rotaDe } from './rota'

describe('rotaDe', () => {
  it.each([
    ['/', { nome: 'mesa' }],
    ['/online', { nome: 'online' }],
    ['/online/', { nome: 'online' }],
    ['/sala/ABCDE', { nome: 'sala', codigo: 'ABCDE' }],
    ['/sala/abcde', { nome: 'sala', codigo: 'ABCDE' }],
    ['/qualquer', { nome: 'mesa' }],
  ])('%s → %o', (p, r) => expect(rotaDe(p)).toEqual(r))
})
