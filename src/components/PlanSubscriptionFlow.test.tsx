import {describe,expect,it} from 'vitest'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {PlanSubscriptionFlow} from './PlanSubscriptionFlow'
describe('Plan subscription confirmation',()=>{
 const view=(promoCode:string)=>renderToStaticMarkup(createElement(PlanSubscriptionFlow,{
  plan:'full',priceLabel:'R$ 10,00 / mês',promoCode,busy:false,error:'',
  onCodeChange:()=>{},onConfirm:()=>{},onCancel:()=>{}
 }))
 it('shows confirmation and pay-after-confirmation notice',()=>{
  const html=view('')
  expect(html).toContain('O plano estará disponível após a confirmação do pagamento pelo Asaas')
  expect(html).toContain('Resgatar por Código Promocional')
  expect(html).toContain('Assinar')
  expect(html).toContain('Cancelar')
  expect(html).not.toContain('PAY-XXXX')
  expect(html).not.toContain('placeholder=')
 })
 it('keeps manually entered promo text visible for validation',()=>{
  expect(view('TESTEFULL')).toContain('value="TESTEFULL"')
 })
})
