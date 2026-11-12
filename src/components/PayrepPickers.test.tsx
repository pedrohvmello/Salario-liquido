import {createElement,Fragment} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe,expect,it} from 'vitest'
import {PayrepSelect} from './PayrepSelect'
import {PayrepDatePicker} from './PayrepDatePicker'
import {PayrepTimePicker} from './PayrepTimePicker'

describe('Payrep pickers',()=>{
 it('renders selected option from dynamic arrays without native select',()=>{
  const options=[['salary','Alteração de salário'],['espp','ESPP %']]
  const html=renderToStaticMarkup(createElement(PayrepSelect,{value:'espp',title:'Tipo de evento'},
   createElement(Fragment,null,...options.map(([value,label])=>createElement('option',{key:value,value},label)))))
  expect(html).toContain('ESPP %')
  expect(html).toContain('aria-haspopup="dialog"')
  expect(html).not.toContain('<select')
 })
 it('shows the empty city label while waiting for data',()=>{
  const html=renderToStaticMarkup(createElement(PayrepSelect,{value:'',disabled:true},
   createElement('option',{value:''},'Carregando municípios...')))
  expect(html).toContain('Carregando municípios...')
  expect(html).toContain('disabled=""')
 })
 it('formats local calendar dates and avoids native Android date input',()=>{
  const html=renderToStaticMarkup(createElement(PayrepDatePicker,{value:'2026-11-12',onChange:()=>{}}))
  expect(html).toContain('12/11/2026')
  expect(html).not.toContain('type="date"')
  expect(html).toContain('aria-haspopup="dialog"')
 })
 it('renders precise HH:MM time with custom UI',()=>{
  const html=renderToStaticMarkup(createElement(PayrepTimePicker,{value:'18:37',onChange:()=>{}}))
  expect(html).toContain('18:37')
  expect(html).not.toContain('type="time"')
 })
})
