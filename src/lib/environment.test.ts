import {describe,expect,it} from 'vitest'
import {resolvePayrepEnvironment,resolvePepEnabled} from './environment'

describe('Payrep environment isolation',()=>{
 it('uses HML only when the dedicated HML project ref is configured',()=>{
  expect(resolvePayrepEnvironment('nrpqcrhschztdwbfgnyo')).toBe('hml')
  expect(resolvePayrepEnvironment(undefined)).toBe('prd')
  expect(resolvePayrepEnvironment('')).toBe('prd')
 })
 it('requires an explicit enablement in production',()=>{
  expect(resolvePepEnabled(undefined,'prd')).toBe(false)
  expect(resolvePepEnabled('true','prd')).toBe(true)
  expect(resolvePepEnabled('false','prd')).toBe(false)
 })
 it('retains the HML pilot fallback and honors an explicit kill switch',()=>{
  expect(resolvePepEnabled(undefined,'hml')).toBe(true)
  expect(resolvePepEnabled('false','hml')).toBe(false)
 })
})
