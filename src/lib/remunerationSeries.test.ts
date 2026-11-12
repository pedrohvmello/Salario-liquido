import {describe,expect,it} from 'vitest'
import {remunerationSeries} from './remunerationSeries'
const months=[
 {period:'2023-12',bruto:12000,liquido:7000,ferias:0},
 {period:'2024-01',bruto:13000,liquido:8000,ferias:0},
 {period:'2024-04',bruto:23028.89,liquido:14379.49,ferias:14379.49},
 {period:'2024-12',bruto:12599.88,liquido:7260.59,ferias:0}
]
describe('remuneração em todos os anos',()=>{
 it('consolida por ano as mesmas parcelas que aparecem na visão mensal',()=>{
  expect(remunerationSeries(months,'all')).toEqual([
   {period:'2023',bruto:12000,liquido:7000,ferias:0},
   {period:'2024',bruto:48628.77,liquido:29640.08,ferias:14379.49}
  ])
 })
 it('conserva mensalidades e meses sem documentos não são inventados',()=>{
  expect(remunerationSeries(months,'2024')).toEqual([
   {period:'01/24',bruto:13000,liquido:8000,ferias:0},
   {period:'04/24',bruto:23028.89,liquido:14379.49,ferias:14379.49},
   {period:'12/24',bruto:12599.88,liquido:7260.59,ferias:0}
  ])
 })
 it('não converte dados ausentes em zero',()=>{
  expect(remunerationSeries([{period:'2025-01',bruto:null,liquido:null,ferias:0}],'all'))
   .toEqual([{period:'2025',bruto:null,liquido:null,ferias:0}])
 })
})
