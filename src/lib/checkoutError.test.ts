import {describe,expect,it} from 'vitest'
import {checkoutInvokeErrorMessage} from './checkoutError'

describe('checkout invoke error handling',()=>{
 it('shows the Asaas validation error from a JSON Response',async()=>{
  const error={context:new Response(JSON.stringify({error:'Asaas Sandbox (HTTP 400): valor inválido.'}),{
   status:502,headers:{'Content-Type':'application/json'}
  })}
  await expect(checkoutInvokeErrorMessage(error))
   .resolves.toBe('Asaas Sandbox (HTTP 400): valor inválido.')
 })
 it('does not call json on relay or network errors',async()=>{
  const error={context:new TypeError('Failed to fetch')}
  await expect(checkoutInvokeErrorMessage(error))
   .resolves.toContain('checkout de homologação')
 })
 it('handles non-JSON HTTP error bodies safely',async()=>{
  const error={context:new Response('<html>Unavailable</html>',{status:503})}
  await expect(checkoutInvokeErrorMessage(error))
   .resolves.toContain('checkout de homologação')
 })
 it('handles missing context and malformed errors',async()=>{
  await expect(checkoutInvokeErrorMessage(new Error('network issue')))
   .resolves.toContain('checkout de homologação')
  await expect(checkoutInvokeErrorMessage(null))
   .resolves.toContain('checkout de homologação')
 })
})
