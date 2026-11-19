import {describe,it,expect} from 'vitest'
import {buildSalaryProjection,salaryProjectionIntent} from '../../supabase/functions/support-ai/salaryProjection.ts'
import {calculatePayroll2026,defaults} from './money'

const now='2026-11-19'
const wage=(v:number)=>[{kind:'salary',effective_date:'2026-01-01',value:v}]
const projection=(question:string,events=wage(15000),settings:unknown={})=>
 buildSalaryProjection({question,events,settings,now,firstName:'Ana'})

describe('Pep deterministic salary projections',()=>{
 it('understands follow-ups after asking about yearly income',()=>{
  expect(salaryProjectionIntent('Mas baseado no meu salário atual vc pode fazer uma projeção',
   [{role:'user',content:'Quanto vou receber no ano?'},{role:'assistant',content:'Não consigo.'}])).toBe(true)
  const result=buildSalaryProjection({question:'Mas baseado no meu salário atual vc pode fazer uma projeção',
   history:[{role:'user',content:'Quanto vou receber em 2026?'}],events:wage(15000),settings:{},now,firstName:'Ana'})
  expect(result?.answer).toContain('Ana,')
  expect(result?.answer).toContain('2026')
  expect(result?.answer).toContain('195.000,00')
 })
 it('estimates the recurring 12 months plus a separate thirteenth',()=>{
  const result=projection('Quanto vou receber por ano?')
  expect(result?.answer).toContain('180.000,00')
  expect(result?.answer).toContain('195.000,00')
  const m=calculatePayroll2026({...defaults,salary:15000})
  expect(result?.answer).toContain(new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(m.netMonth))
 })
 it('applies current trienio and ignores future or hidden salary events',()=>{
  const result=buildSalaryProjection({question:'Projeção para 2027',now,
   events:[...wage(15000),{kind:'trienio',effective_date:'2026-06-01',value:179},
    {kind:'salary',effective_date:'2026-12-01',value:25000},
    {kind:'salary',effective_date:'2026-08-01',value:90000,hidden:true}],
   settings:{},firstName:'Ana'})
  expect(result?.answer).toContain('15.179,00')
  expect(result?.answer).toContain('197.327,00')
  expect(result?.answer).toContain('regras de 2026')
 })
 it('simulates percentage salary increases without mutating saved events',()=>{
  const events=wage(10000)
  const result=buildSalaryProjection({question:'Faça uma simulação com aumento de 10%',events,settings:{},now})
  expect(result?.answer).toContain('11.000,00')
  expect(events[0].value).toBe(10000)
 })
 it('accepts an explicit gross salary if no salary is configured',()=>{
  const result=projection('Simule salário de R$ 15.000',[],{})
  expect(result?.answer).toContain('15.000,00')
  expect(result?.answer).toContain('195.000,00')
 })
 it('does not fabricate a salary when neither values nor events exist',()=>{
  const result=projection('Faça uma projeção anual',[],{})
  expect(result?.answer).toContain('não encontrei um salário-base vigente')
 })
 it('respects pension criteria in annual projection',()=>{
  const pensionNote='@payrep:pension-rule:v1:'+JSON.stringify({note:'',rule:{
   excludeInss:true,excludeIrrf:true,includeOvertime:true,includeVacation:true,
   includeVacationThird:true,includeThirteenth:false,includePpr:false}})
  const withoutThirteenth=buildSalaryProjection({question:'Estimar meu rendimento anual',now,
   events:[...wage(15000),{kind:'pensionPercent',value:26,effective_date:'2026-01-01',notes:pensionNote}],
   settings:{}})
  const withThirteenth=buildSalaryProjection({question:'Estimar meu rendimento anual',now,
   events:[...wage(15000),{kind:'pensionPercent',value:26,effective_date:'2026-01-01'}],
   settings:{}})
  expect(withoutThirteenth?.answer).not.toBe(withThirteenth?.answer)
 })
 it('keeps procedural help requests in the ordinary assistant flow',()=>{
  expect(salaryProjectionIntent('Como funciona a projeção na Visão Geral?')).toBe(false)
 })
})
