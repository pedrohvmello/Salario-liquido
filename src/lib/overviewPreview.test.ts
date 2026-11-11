import {describe,expect,it} from 'vitest'
import {isHomologationHost} from './overviewPreview'
describe('HML-only overview staging',()=>{
 it('allows only dedicated homologation hostname',()=>{
  expect(isHomologationHost('salario-liquido-hml.vercel.app')).toBe(true)
  expect(isHomologationHost('salario-liquido-hml-git-release.vercel.app')).toBe(true)
  expect(isHomologationHost('payrep.com.br')).toBe(false)
  expect(isHomologationHost('www.payrep.com.br')).toBe(false)
  expect(isHomologationHost('salario-liquido.vercel.app')).toBe(false)
 })
})
