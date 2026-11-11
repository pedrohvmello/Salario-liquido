import {Info} from 'lucide-react'
import {brl} from '../lib/money'
import {type ThirteenthLedger} from '../lib/thirteenthLedger'
export function ThirteenthOverview({ledger,year}:{ledger:ThirteenthLedger;year:string}){
 const rows=ledger.occurrences.filter(x=>year==='all'||x.year===year)
 return <section className="panel">
  <div className="panel-heading"><h2>13º salário e conciliação</h2><span className="pill">{rows.length} recibo(s)</span></div>
  <p className="subtle">O holerite específico é a fonte de bruto, INSS, IRRF, pensão e líquido. O adiantamento já registrado nas férias/folhas não é somado novamente.</p>
  {rows.length?<div className="table-scroll"><table className="thirteenth-table"><colgroup>
   <col className="thirteenth-year"/><col className="thirteenth-gross"/><col className="thirteenth-advance"/>
   <col className="thirteenth-matched"/><col className="thirteenth-closing"/><col className="thirteenth-cash"/>
   <col className="thirteenth-irrf"/><col className="thirteenth-inss"/><col className="thirteenth-pension"/>
   <col className="thirteenth-status"/><col className="thirteenth-comment"/>
  </colgroup><thead><tr>
   <th>Ano</th><th>13º bruto</th><th>Adiantamento descontado</th><th>Já registrado antes</th>
   <th>Fechamento do 13º</th><th>Recebimento adicional*</th><th>IRRF exclusivo</th><th>INSS 13º</th><th>Pensão 13º</th><th>Conciliação</th><th>Comentário</th>
  </tr></thead><tbody>{rows.map(r=><tr key={r.statementId}>
   <td><strong>{r.year}</strong></td><td>{brl(r.gross)}</td><td>{brl(r.advance)}</td>
   <td>{brl(r.matchedAdvance)}</td><td>{brl(r.closingNet)}</td>
   <td><strong>{brl(r.cashAdditional)}</strong></td><td>{brl(r.irrf)}</td><td>{brl(r.inss)}</td><td>{brl(r.pension)}</td>
   <td><span className={r.state==='reconciled'?'ok':'flag'}>{
    r.state==='reconciled'?'Conciliado':r.state==='estimated'?'Adiantamento estimado':r.state==='partial'?'Parcial':'Diferença'
   }</span></td><td className="thirteenth-comment-cell"><span className="thirteenth-comment-preview subtle" title={r.note}>{r.note||'—'}</span></td>
  </tr>)}</tbody></table></div>:<p className="subtle">Nenhum recibo anual de 13º identificado no período.</p>}
  <div className="detail-hint"><Info size={16}/> *Recebimento adicional é o líquido do fechamento mais a parte do adiantamento que não foi identificada em registros anteriores. O total do 13º pode incluir pagamentos já contabilizados nas férias. Os valores são distintos da remuneração mensal e do PPR.</div>
 </section>
}
