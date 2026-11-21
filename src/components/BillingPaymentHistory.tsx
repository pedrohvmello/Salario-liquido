import {Fragment,useState} from 'react'
import {ChevronDown,ExternalLink,FileText,ReceiptText,ShieldCheck} from 'lucide-react'
import {paymentStatusText} from '../lib/adminEntitlements'
import {loadMyPaymentDocuments,type BillingPayment,type BillingPaymentDocuments} from '../lib/account'

const money=(amount:number,code:string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:code||'BRL'}).format(amount/100)
const date=(raw:string|null)=>raw?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(raw)):'—'
const methods:Record<string,string>={PIX:'Pix',BOLETO:'Boleto',CREDIT_CARD:'Cartão de crédito',DEBIT_CARD:'Cartão de débito',TRANSFER:'Transferência',RECEIVED_IN_CASH:'Dinheiro',UNDEFINED:'Não informado'}
type State={loading:boolean;value?:BillingPaymentDocuments;error?:string}

export function BillingPaymentHistory({payments}:{payments:BillingPayment[]}){
 const [openId,setOpenId]=useState<string|null>(null)
 const [documents,setDocuments]=useState<Record<string,State>>({})
 const toggle=(id:string)=>{
  if(openId===id){setOpenId(null);return}
  setOpenId(id)
  if(documents[id]?.loading||documents[id]?.value)return
  void refresh(id)
 }
 const refresh=async(id:string)=>{
  setDocuments(prev=>({...prev,[id]:{loading:true}}))
  try{
   const value=await loadMyPaymentDocuments(id)
   setDocuments(prev=>({...prev,[id]:{loading:false,value}}))
  }catch(e){
   setDocuments(prev=>({...prev,[id]:{loading:false,error:e instanceof Error?e.message:'Não foi possível consultar os documentos.'}}))
  }
 }
 return <section className="panel billing-payment-history">
  <div className="panel-heading"><h2><ShieldCheck size={17}/> Pagamentos</h2></div>
  {payments.length?<div className="table-scroll billing-payment-table-scroll">
   <table className="mobile-stack-table mobile-subscription-payments billing-payment-table">
    <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Vencimento</th><th>Documentos</th></tr></thead>
    <tbody>{payments.map(payment=>{
     const expanded=openId===payment.id
     const state=documents[payment.id]
     const hasDocs=Boolean(state?.value?.invoiceUrl||state?.value?.receiptUrl)
     return <Fragment key={payment.id}>
      <tr className={expanded?'billing-payment-expanded':''}>
       <td>{date(payment.paid_at||payment.created_at)}</td>
       <td>{payment.description||payment.provider}</td>
       <td><strong>{money(payment.amount_cents,payment.currency)}</strong></td>
       <td>{paymentStatusText(payment.status)}</td>
       <td>{date(payment.due_at)}</td>
       <td>{payment.provider==='asaas'?<button type="button" className="secondary billing-documents-toggle"
        onClick={()=>toggle(payment.id)} aria-expanded={expanded} aria-controls={'billing-docs-'+payment.id}>
        <FileText size={15}/> {expanded?'Ocultar':'Ver documentos'} <ChevronDown size={15} className={expanded?'is-open':''}/>
       </button>:<span className="subtle">Indisponível</span>}</td>
      </tr>
      {expanded&&<tr className="billing-payment-details-row" id={'billing-docs-'+payment.id}>
       <td colSpan={6}>
        <div className="billing-payment-document-panel" aria-live="polite">
         {state?.loading?<p>Consultando documentos no Asaas...</p>:state?.error?
          <div className="billing-document-error" role="alert"><span>{state.error}</span>
           <button type="button" className="secondary" onClick={()=>void refresh(payment.id)}>Tentar novamente</button></div>:
          state?.value?<div className="billing-document-content">
           <div className="billing-document-meta">
            <strong>Documentos da cobrança</strong>
            {state.value.invoiceNumber&&<span>Fatura nº {state.value.invoiceNumber}</span>}
            {state.value.billingType&&<span>Forma de pagamento: {methods[state.value.billingType]||state.value.billingType}</span>}
           </div>
           {hasDocs?<div className="billing-document-actions">
            {state.value.invoiceUrl&&<a href={state.value.invoiceUrl} target="_blank" rel="noopener noreferrer" className="secondary"><FileText size={16}/> Abrir fatura <ExternalLink size={14}/></a>}
            {state.value.receiptUrl&&<a href={state.value.receiptUrl} target="_blank" rel="noopener noreferrer" className="secondary"><ReceiptText size={16}/> Ver comprovante <ExternalLink size={14}/></a>}
           </div>:<p className="subtle">O Asaas ainda não disponibilizou fatura ou comprovante para esta cobrança.</p>}
          </div>:<p>Consultando documentos...</p>}
        </div>
       </td>
      </tr>}
     </Fragment>
    })}</tbody>
   </table>
  </div>:<p className="subtle">Nenhum pagamento registrado.</p>}
  <p className="subtle billing-payments-note">As faturas e os comprovantes são disponibilizados pelo Asaas quando existentes. A fatura de cobrança não equivale a uma nota fiscal.</p>
 </section>
}
