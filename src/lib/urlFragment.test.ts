import {describe,expect,it} from 'vitest'
import {pathnameWithoutEmptyFragment} from './urlFragment'

describe('cleanup of browser address',()=>{
 it('removes only empty trailing hash with path and query preserved',()=>{
  expect(pathnameWithoutEmptyFragment('https://payrep.com.br/#')).toBe('/')
  expect(pathnameWithoutEmptyFragment('https://payrep.com.br/?source=mail#')).toBe('/?source=mail')
 })
 it('does not remove OAuth tokens, error messages, routing or recovery fragments',()=>{
  expect(pathnameWithoutEmptyFragment('https://payrep.com.br/#access_token=secret&refresh_token=secret')).toBeNull()
  expect(pathnameWithoutEmptyFragment('https://payrep.com.br/#type=recovery')).toBeNull()
  expect(pathnameWithoutEmptyFragment('https://payrep.com.br/#/settings')).toBeNull()
  expect(pathnameWithoutEmptyFragment('https://payrep.com.br/')).toBeNull()
 })
})
