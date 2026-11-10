import {AlertTriangle,CheckCircle2,Info} from 'lucide-react'
import {brl} from '../lib/money'
import {type VacationLedger,vacationStateLabel} from '../lib/vacation'
const date=(value:string|null)=>value?value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4):'Não identificada'
export function VacationOverview({ledger,year}:{ledger:VacationLedger;year:string}){
 const rows=ledger.occurrences.filter(x=>year==='all'||x.month.startsWith(year))
 return <section className="panel">
   <div className="panel-heading"><h2>Férias e conciliação</h2><span className="pill">{rows.length} ocorrência(s)</span></div>
   <p className="subtle">As folhas mensais são a fonte principal. O recibo de férias é opcional e substitui o valor inferido das rubricas quando disponível. Nenhum pagamento é somado duas vezes.</p>
   {rows.length?<div className="table-scroll"><table>
    <thead><tr><th>Competência financeira</th><th>Período de férias</th><th>Estimado pela folha</th><th>Líquido do recibo</th><th>Valor contabilizado</th><th>Conciliação</th></tr></thead>
    <tbody>{rows.map(x=><tr key={x.key}>
     <td><strong>{x.month.slice(5)}/{x.month.slice(0,4)}</strong></td>
     <td>{x.vacationStart&&x.vacationEnd?date(x.vacationStart)+' a '+date(x.vacationEnd):'A confirmar'}</td>
     <td>{x.monthlyIds.length?brl(x.inferred):'Não identificado'}</td>
     <td>{x.receiptNet===null?'Opcional':brl(x.receiptNet)}</td>
     <td><strong>{brl(x.booked)}</strong></td>
     <td><span className={x.state==='reconciled'?'ok':x.state==='difference'?'flag':'pill'}>{vacationStateLabel(x.state)}</span>
      {x.difference!==null&&Math.abs(x.difference)>.02&&<div className="subtle">Diferença folha − recibo: {brl(x.difference)}</div>}
      <div className="subtle">{x.note}</div></td>
    </tr>)}</tbody>
   </table></div>:<p className="subtle">Nenhuma ocorrência de férias identificada nos documentos importados.</p>}
   <div className="detail-hint">
    {rows.some(x=>x.state==='difference')?<AlertTriangle size={16}/>:rows.some(x=>x.state==='reconciled')?<CheckCircle2 size={16}/>:<Info size={16}/>}
    O mês financeiro é o início do período de férias quando há recibo; sem ele, é a competência do holerite mensal. A data real é preservada para futura conferência fiscal.
   </div>
  </section>
}
