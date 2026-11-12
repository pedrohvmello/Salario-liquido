import {expect,it,describe} from 'vitest'
import {cropScale,cropOffsetClamp} from './avatarCrop'
describe('Circular photo cropping geometry',()=>{
 it('fills a circular preview without blank edges',()=>{
  const f=cropScale(268,400,100)
  expect(400*f).toBeGreaterThanOrEqual(268)
  expect(100*f).toBe(268)
 })
 it('clamps drag offsets within image',()=>{
  expect(cropOffsetClamp({x:500,y:-500},268,400,300)).toEqual({x:66,y:-16})
  expect(cropOffsetClamp({x:50,y:20},268,268,268)).toEqual({x:0,y:0})
 })
 it('supports zoom up to 3x',()=>expect(cropScale(268,268,268,3)).toBe(3))
})
