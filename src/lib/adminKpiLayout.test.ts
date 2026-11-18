import {describe,expect,it} from 'vitest'
import {adminKpiIds,normalizeAdminKpiOrder,normalizeAdminKpiColors,reorderAdminKpi,chooseAdminKpiColor} from './adminKpiLayout'

describe('Admin dashboard KPI customization',()=>{
 it('preserves the ten default metrics',()=>{
  expect(adminKpiIds).toHaveLength(10)
  expect(normalizeAdminKpiOrder(undefined)).toEqual(adminKpiIds)
 })
 it('reorders and persists explicit visibility without restoring hidden KPIs',()=>{
  const ids=normalizeAdminKpiOrder(['registered','pending','approved','approved','invalid'])
  expect(ids).toEqual(['registered','pending','approved'])
  expect(reorderAdminKpi(ids,'approved',0)).toEqual(['approved','registered','pending'])
  expect(normalizeAdminKpiOrder([])).toEqual([])
 })
 it('sanitizes palette values and supports restoring white',()=>{
  const blue=chooseAdminKpiColor({},'registered','blue')
  const green=chooseAdminKpiColor(blue,'approved','green')
  expect(green).toEqual({registered:'blue',approved:'green'})
  expect(chooseAdminKpiColor(green,'registered','default')).toEqual({approved:'green'})
  expect(normalizeAdminKpiColors({approved:'lavender',blocked:'<script>',other:'pink'}))
   .toEqual({approved:'lavender'})
 })
})
