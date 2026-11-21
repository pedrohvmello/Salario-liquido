import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'

const page=readFileSync('src/components/SubscriptionPage.tsx','utf8')
const history=readFileSync('src/components/BillingPaymentHistory.tsx','utf8')
const api=readFileSync('supabase/functions/billing-payment-documents/index.ts','utf8')
const account=readFileSync('src/lib/account.ts','utf8')
const css=readFileSync('src/styles.css','utf8')

describe('Customer subscription payment history',()=>{
 it('shows payments instead of the technical checkout ledger without removing reconciliation',()=>{
  expect(page).not.toContain('Checkouts de assinatura')
  expect(page).toContain('<BillingPaymentHistory payments={data.payments}/>')
  expect(page).toContain('loadMyCheckoutIntents()')
  expect(page).toContain("intents.some(i=>i.status==='paid')")
 })
 it('provides per-payment links only when Asaas makes them available',()=>{
  expect(history).toContain('loadMyPaymentDocuments(id)')
  expect(history).toContain('state.value.invoiceUrl&&')
  expect(history).toContain('state.value.receiptUrl&&')
  expect(history).toContain('rel="noopener noreferrer"')
  expect(history).toContain('não equivale a uma nota fiscal')
  expect(account).toContain("db.functions.invoke('billing-payment-documents'")
 })
 it('resolves provider URLs under authenticated payment ownership, without browser API secrets',()=>{
  expect(api).toContain("client.auth.getUser(token)")
  expect(api).toContain(".eq('id',paymentId).eq('user_id',user.id)")
  expect(api).toContain("client.from('billing_payments')")
  expect(api).toContain("PAYREP_ASAAS_SANDBOX_ENABLED")
  expect(api).toContain("ASAAS_SANDBOX_API_KEY")
  expect(api).toContain("charge.id")
  expect(api).toContain('safeDocumentUrl(charge.invoiceUrl)')
  expect(api).toContain('safeDocumentUrl(charge.transactionReceiptUrl)')
  expect(api).toContain("url.protocol!=='https:'")
  expect(api).toContain('www.asaas.com')
  expect(api).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
 })
 it('keeps the responsive payment view and labels',()=>{
  expect(css).toContain('.billing-payment-details-row')
  expect(css).toContain('.mobile-stack-table.mobile-subscription-payments tbody td:nth-child(6)::before')
 })
})
