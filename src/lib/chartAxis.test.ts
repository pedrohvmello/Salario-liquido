import {describe,expect,it} from 'vitest'
import {formatMoneyAxisTick} from './chartAxis'
describe('Valores do eixo vertical nos gráficos',()=>{
 it('não transforma marcas abaixo de mil em 0k repetidos',()=>{
  const ticks=[0,65,130,195,260,325].map(formatMoneyAxisTick)
  expect(ticks).toEqual(['0','65','130','195','260','325'])
  expect(new Set(ticks).size).toBe(ticks.length)
 })
 it('mostra milhares e frações relevantes sem perder a escala',()=>{
  expect(formatMoneyAxisTick(1000)).toBe('1 mil')
  expect(formatMoneyAxisTick(1250)).toBe('1,25 mil')
  expect(formatMoneyAxisTick(25000)).toBe('25 mil')
  expect(formatMoneyAxisTick(1500000)).toBe('1,5 mi')
 })
 it('trata negativos, decimais pequenos, zero e não finitos',()=>{
  expect(formatMoneyAxisTick(-500)).toBe('-500')
  expect(formatMoneyAxisTick(-1250)).toBe('-1,25 mil')
  expect(formatMoneyAxisTick(0.25)).toBe('0,25')
  expect(formatMoneyAxisTick(0)).toBe('0')
  expect(formatMoneyAxisTick(Number.NaN)).toBe('—')
 })
})
