import {describe,it,expect} from 'vitest'
import {
 adjacentMobilePrimaryView,
 mobileSwipeDirection,
 mobileSwipeProgress,
 mobileSwipeShouldComplete,
 relativeMobilePrimaryDirection,
 type MobilePrimaryView
} from './mobile-primary-navigation'

const primary:MobilePrimaryView[]=['overview','history','hours','events','analytics','income-tax','imports','definitions']
const admin:MobilePrimaryView[]=[...primary,'admin','admin-settings']

describe('Payrep mobile swipe navigation matches sidebar order',()=>{
 it('moves left to the next item and right to the previous',()=>{
  expect(adjacentMobilePrimaryView('overview',primary,'next')).toBe('history')
  expect(adjacentMobilePrimaryView('history',primary,'previous')).toBe('overview')
  expect(adjacentMobilePrimaryView('history',primary,'next')).toBe('hours')
  expect(adjacentMobilePrimaryView('events',primary,'next')).toBe('analytics')
  expect(adjacentMobilePrimaryView('definitions',primary,'next')).toBeNull()
 })
 it('only exposes administration routes to administrators',()=>{
  expect(adjacentMobilePrimaryView('definitions',admin,'next')).toBe('admin')
  expect(adjacentMobilePrimaryView('admin',admin,'next')).toBe('admin-settings')
  expect(adjacentMobilePrimaryView('admin-settings',admin,'next')).toBeNull()
  expect(adjacentMobilePrimaryView('admin',primary,'previous')).toBeNull()
 })
 it('requires mostly horizontal intent to avoid vertical scroll',()=>{
  expect(mobileSwipeDirection(-90,12)).toBe('next')
  expect(mobileSwipeDirection(90,11)).toBe('previous')
  expect(mobileSwipeDirection(-29,200)).toBeNull()
  expect(mobileSwipeDirection(-40,4)).toBeNull()
  expect(mobileSwipeShouldComplete(-95,10,-.4,'next')).toBe(true)
  expect(mobileSwipeShouldComplete(95,10,.7,'previous')).toBe(true)
  expect(mobileSwipeShouldComplete(-40,70,-.8,'next')).toBe(false)
 })
 it('maintains a clamped visual progress and direction on navigation',()=>{
  expect(mobileSwipeProgress(-5,400,'next')).toBe(0)
  expect(mobileSwipeProgress(-400,400,'next')).toBe(1)
  expect(relativeMobilePrimaryDirection('hours','history',primary)).toBe('previous')
  expect(relativeMobilePrimaryDirection('overview','events',primary)).toBe('next')
 })
})
