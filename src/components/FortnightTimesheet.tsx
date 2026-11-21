import {useMemo,useState} from 'react'
import {Info,RotateCcw,Save} from 'lucide-react'
import {classifyHours,type DayEntry,type Overtime} from '../lib/calendar'
import {recordedHoursBalanceMinutes,type WorkRegime} from '../lib/workRegime'
import {calculateBankLedger,formatBankMinutes,paidOvertime,shouldAutoBankShortDay,type TimeBankPolicy} from '../lib/timeBank'
import {fortnightDays,getFortnight,todayInSaoPaulo} from '../lib/fortnight'
import {saveTimeEntries} from '../lib/data'
import {clearedFortnightHours} from '../lib/fortnightReset'
import {PayrepConfirmDialog} from './PayrepConfirmDialog'

type TimeRow=DayEntry&{id:string}
type Field='start'|'lunchStart'|'lunchEnd'|'end'|'additionalHours'|'comments'
type GridRow={date:string;entry:DayEntry;calculated:Overtime|null;complete:boolean;invalid:boolean;holiday:boolean;automaticHoliday:boolean}
type Props={
 anchor:string
 records:TimeRow[]
 holidayDates:ReadonlySet<string>|null
 policies:TimeBankPolicy[]
 baseName:string
 workRegime:WorkRegime
 onSaved:()=>Promise<void>
}
const empty=(date:string):DayEntry=>({
 date,start:'',lunchStart:'',lunchEnd:'',end:'',holidayOverride:null,
 additionalHours:'',comments:'',bankHours:false
})
const timeFields=['start','lunchStart','lunchEnd','end'] as const
const formatDate=(value:string)=>value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4)
const weekday=(date:string)=>new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))
const hours=(value:number)=>value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+' h'
const clock=/^([01]\d|2[0-3]):[0-5]\d$/
const normalize=(value:string)=>{const m=/^(\d{1,2}):(\d{2})$/.exec(value.trim());return m?m[1].padStart(2,'0')+':'+m[2]:value.trim()}

export function FortnightTimesheet({anchor,records,holidayDates,policies,baseName,workRegime,onSaved}:Props){
 const trust=workRegime==='trust'
 const [drafts,setDrafts]=useState<Record<string,DayEntry>>({})
 const [saving,setSaving]=useState(false)
 const [resetOpen,setResetOpen]=useState(false)
 const [manuallySetBank,setManuallySetBank]=useState<Record<string,boolean>>({})
 const [automaticallyMarked,setAutomaticallyMarked]=useState<Record<string,boolean>>({})
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const period=getFortnight(anchor)
 const dates=fortnightDays(anchor)
 const today=todayInSaoPaulo()
 const byDate=useMemo(()=>new Map(records.map(row=>[row.date,row])),[records])
 const read=(date:string)=>drafts[date]??byDate.get(date)??empty(date)
 const change=(date:string,patch:Partial<DayEntry>)=>{
  const explicitBank=Object.prototype.hasOwnProperty.call(patch,'bankHours')
  const existing=read(date)
  const affectsBank=['start','lunchStart','lunchEnd','end','additionalHours','bankHours','holidayOverride']
   .some(key=>Object.prototype.hasOwnProperty.call(patch,key))
  const next:DayEntry={...existing,...patch,...(affectsBank?{bankDeltaMinutes:undefined,bankWeightedMinutes:undefined}:{})}
  if(explicitBank){
   setManuallySetBank(previous=>({...previous,[date]:true}))
   setAutomaticallyMarked(previous=>({...previous,[date]:false}))
  }else{
   const modifyingHours=['start','lunchStart','lunchEnd','end','additionalHours','holidayOverride']
    .some(key=>Object.prototype.hasOwnProperty.call(patch,key))
   if(modifyingHours&&!trust&&!manuallySetBank[date]){
    const shouldAuto=shouldAutoBankShortDay(next,holidayDates,policies)
    if(shouldAuto&&!existing.bankHours){
     next.bankHours=true
     setAutomaticallyMarked(current=>({...current,[date]:true}))
    }else if(!shouldAuto&&automaticallyMarked[date]){
     next.bankHours=false
     setAutomaticallyMarked(current=>({...current,[date]:false}))
    }
   }
  }
  setDrafts(previous=>({...previous,[date]:next}))
  setMessage('');setError('')
 }
 const rows:GridRow[]=dates.map(date=>{
  const entry=read(date)
  const complete=timeFields.every(key=>clock.test(entry[key]))
  const automaticHoliday=holidayDates?.has(date)??false
  let calculated:Overtime|null=null
  let invalid=false
  if(complete){
   try{
    // No calculated value is shown until the actual Base holiday catalog is available.
    const checked=paidOvertime(entry,holidayDates??new Set<string>())
    if(holidayDates||trust)calculated=checked
   }catch{invalid=true}
  }
  return {
   date,entry,calculated,complete,invalid,
   automaticHoliday,holiday:entry.holidayOverride??automaticHoliday
  }
 })
 const dirtyCurrent=dates.filter(date=>Object.prototype.hasOwnProperty.call(drafts,date))
 const dirtyOutside=Object.keys(drafts).filter(date=>!dates.includes(date)).length
 const savedBank=calculateBankLedger(records,holidayDates,policies)
 const previewEntries=[
  ...records.filter(row=>!dirtyCurrent.includes(row.date)),
  ...dirtyCurrent.map(date=>({
   ...read(date),
   effectiveHoliday:read(date).holidayOverride??(holidayDates?.has(date)??read(date).effectiveHoliday??false)
  }))
 ]
 const previewBank=calculateBankLedger(previewEntries,holidayDates,policies)
 const savedBalance=trust?recordedHoursBalanceMinutes(records,holidayDates,policies):savedBank.balanceMinutes
 const previewBalance=trust?recordedHoursBalanceMinutes(previewEntries,holidayDates,policies):previewBank.balanceMinutes
 const calculated=rows.map(row=>row.calculated).filter((value):value is Overtime=>value!==null)
 const totals=calculated.reduce((result,calc)=>({
  worked:result.worked+calc.total,
  extra:result.extra+calc.h60+calc.h80+calc.h100,
  h60:result.h60+calc.h60,h80:result.h80+calc.h80,h100:result.h100+calc.h100
 }),{worked:0,extra:0,h60:0,h80:0,h100:0})
 const resetHours=async()=>{
  if(saving)return
  setSaving(true);setError('');setMessage('')
  try{
   const targets=dates.filter(date=>byDate.has(date)||Object.prototype.hasOwnProperty.call(drafts,date))
   const cleared=targets.map(date=>clearedFortnightHours(read(date)))
   if(cleared.length)await saveTimeEntries(cleared)
   setDrafts(previous=>{
    const next={...previous}
    for(const date of dates)delete next[date]
    return next
   })
   setManuallySetBank(previous=>{
    const next={...previous}
    for(const date of dates)delete next[date]
    return next
   })
   setAutomaticallyMarked(previous=>{
    const next={...previous}
    for(const date of dates)delete next[date]
    return next
   })
   setResetOpen(false)
   setMessage('Horários da quinzena zerados. Comentários e marcações de feriado foram mantidos.')
   try{await onSaved()}catch{
    setError('Horários zerados, mas não foi possível atualizar a lista. Recarregue a página.')
   }
  }catch(e){setError(e instanceof Error?e.message:'Falha ao zerar a quinzena.')}
  finally{setSaving(false)}
 }
 const save=async()=>{
  if(!dirtyCurrent.length||saving)return
  setSaving(true);setError('');setMessage('')
  const changed=dirtyCurrent.map(date=>({
   ...read(date),
   effectiveHoliday:read(date).holidayOverride??(holidayDates?.has(date)??read(date).effectiveHoliday??false)
  }))
  for(const entry of changed){
   for(const field of [...timeFields,'additionalHours'] as const){
    const time=entry[field]||''
    if(time&&!clock.test(time)){
     setError('Horário inválido em '+formatDate(entry.date)+'. Use HH:MM (por exemplo, 09:00).')
     setSaving(false);return
    }
   }
   if((entry.comments||'').length>500){
    setError('Comentários acima de 500 caracteres em '+formatDate(entry.date)+'.')
    setSaving(false);return
   }
   if(timeFields.every(field=>Boolean(entry[field]))){
    try{classifyHours(entry,holidayDates??new Set<string>())}
    catch(e){
     setError(formatDate(entry.date)+': '+(e instanceof Error?e.message:'Jornada inválida.'))
     setSaving(false);return
    }
   }
  }
  if(!trust&&changed.some(entry=>entry.bankHours)&&!holidayDates){
   setError('Aguarde o calendário de feriados para registrar movimentos no banco de horas.')
   setSaving(false);return
  }
  const hypothetical=calculateBankLedger([
   ...records.filter(row=>!dirtyCurrent.includes(row.date)),
   ...changed
  ],holidayDates,policies)
  if(!trust&&hypothetical.firstMissingPolicyDate){
   setError('Não existe política de Banco de Horas vigente em '+formatDate(hypothetical.firstMissingPolicyDate)+'. Solicite ao administrador uma nova vigência.')
   setSaving(false);return
  }
    try{
   await saveTimeEntries(changed)
   setDrafts(previous=>{
    const next={...previous}
    for(const date of dirtyCurrent)delete next[date]
    return next
   })
   setManuallySetBank(previous=>{
    const next={...previous}
    for(const date of dirtyCurrent)delete next[date]
    return next
   })
   setAutomaticallyMarked(previous=>{
    const next={...previous}
    for(const date of dirtyCurrent)delete next[date]
    return next
   })
   setMessage(dirtyCurrent.length+' dia(s) salvo(s), inclusive registros parciais.')
   try{await onSaved()}catch{
    setError('Os registros foram gravados, mas não foi possível atualizar a lista. Recarregue a página.')
   }
  }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar a quinzena.')}
  finally{setSaving(false)}
 }

 return <div className="stack payrep-fortnight">
  <section className="panel">
   <div className="fortnight-summary" aria-label="Totais da quinzena">
    <div className={'stat'+(trust?' fortnight-stat-inactive':'')}><span>Extras 60%</span><strong>{trust?'—':hours(totals.h60)}</strong></div>
    <div className={'stat'+(trust?' fortnight-stat-inactive':'')}><span>Extras 80%</span><strong>{trust?'—':hours(totals.h80)}</strong></div>
    <div className={'stat'+(trust?' fortnight-stat-inactive':'')}><span>Extras 100%</span><strong>{trust?'—':hours(totals.h100)}</strong></div>
    <div className={'stat'+(trust?' fortnight-stat-inactive':'')}><span>Total de horas extras</span><strong>{trust?'Não aplicado':hours(totals.extra)}</strong></div>
    <div className="stat"><span>Total trabalhado</span><strong>{hours(totals.worked)}</strong></div>
    <div className="stat"><span>Saldo de Horas{trust?' (informativo)':''}</span>
     <strong className={savedBalance<0?'fortnight-negative-balance':''}>{formatBankMinutes(savedBalance)} h</strong>
     {dirtyCurrent.length>0&&
      <small className={previewBalance<0?'fortnight-negative-balance':''}>Após salvar: {formatBankMinutes(previewBalance)} h</small>}
    </div>
   </div>
   {trust&&<div className="notice subtle-notice" role="status"><Info size={17}/>
    Cargo de confiança: sem cálculo de horas extras ou novos movimentos no banco.
    O saldo informativo compara os horários registrados com a jornada de referência.
    O histórico do banco permanece armazenado.</div>}
   <div className="table-scroll fortnight-scroll" role="region" tabIndex={0}
    aria-label={'Registro de horas da '+period.label}>
    <table className="fortnight-table">
     <thead><tr>
      <th>Data</th><th>Dia da semana</th><th>Entrada</th><th>Almoço início</th>
      <th>Almoço fim</th><th>Saída</th><th>Horas Adicionais</th>
      <th>Banco de Horas</th><th>Hora Extra</th><th>60%</th><th>80%</th>
      <th>100%</th><th>Feriado</th><th>Comentários</th>
     </tr></thead>
     <tbody>{rows.map(row=>{
      const dow=new Date(row.date+'T12:00:00Z').getUTCDay()
      const movement=trust?0:previewBank.movements.get(row.date)?.deltaMinutes??0
      const typed=(key:Field,label:string,placeholder='00:00')=><input
       type="text" inputMode={key==='comments'?'text':'numeric'}
       className={key==='comments'?'fortnight-comment':'fortnight-time-input'}
       aria-label={label+' em '+formatDate(row.date)}
       placeholder={placeholder}
       maxLength={key==='comments'?500:5}
       value={row.entry[key]||''}
       onChange={event=>change(row.date,{[key]:event.target.value})}
       onBlur={key==='comments'?undefined:event=>{
        const normalized=normalize(event.target.value)
        if(normalized!==(row.entry[key]||''))change(row.date,{[key]:normalized})
       }}
      />
      return <tr key={row.date} className={[
       dow===0||dow===6?'fortnight-weekend':'',
       row.holiday?'fortnight-holiday':'',
       row.date===today?'fortnight-today':'',
       movement>0?'fortnight-bank-credit':'',
       movement<0?'fortnight-bank-debit':'',
       dirtyCurrent.includes(row.date)?'fortnight-dirty':'',
       row.invalid?'fortnight-invalid':''
      ].filter(Boolean).join(' ')}>
       <td><strong>{formatDate(row.date)}</strong></td>
       <td>{weekday(row.date)}</td>
       <td>{typed('start','Entrada')}</td>
       <td>{typed('lunchStart','Almoço início')}</td>
       <td>{typed('lunchEnd','Almoço fim')}</td>
       <td>{typed('end','Saída')}</td>
       <td>{typed('additionalHours','Horas adicionais','00:00')}</td>
       <td className="fortnight-bank-cell"><input type="checkbox"
        aria-label={'Banco de Horas em '+formatDate(row.date)}
        title={movement>0?'Crédito ao banco: +'+formatBankMinutes(movement):
          movement<0?'Compensação do banco: '+formatBankMinutes(movement):
          'Crédito ou compensação de horas pelo banco'}
        checked={Boolean(row.entry.bankHours)} disabled={trust}
        onChange={event=>{if(!trust)change(row.date,{bankHours:event.target.checked})}}/></td>
       <td className="fortnight-calculated">{trust?'—':row.invalid?'Inválido':row.calculated?hours(row.calculated.h60+row.calculated.h80+row.calculated.h100):'—'}</td>
       <td className="fortnight-calculated">{!trust&&row.calculated?hours(row.calculated.h60):'—'}</td>
       <td className="fortnight-calculated">{!trust&&row.calculated?hours(row.calculated.h80):'—'}</td>
       <td className="fortnight-calculated">{!trust&&row.calculated?hours(row.calculated.h100):'—'}</td>
       <td><div className="fortnight-holiday-cell">
        <input type="checkbox" aria-label={'Feriado em '+formatDate(row.date)}
         checked={row.holiday}
         onChange={event=>change(row.date,{holidayOverride:event.target.checked})}/>
        {row.entry.holidayOverride!==null&&<button type="button" className="fortnight-reset"
          title="Restaurar calendário automático" aria-label={'Restaurar feriado automático em '+formatDate(row.date)}
          onClick={()=>change(row.date,{holidayOverride:null})}><RotateCcw size={13}/></button>}
       </div></td>
       <td>{typed('comments','Comentários','Observações do dia')}</td>
      </tr>
     })}</tbody>
    </table>
   </div>
   <div className="fortnight-color-legend" aria-label="Legenda das cores da tabela">
    {!trust&&<><span><i className="fortnight-legend-swatch fortnight-legend-credit"/> Azul: crédito no Banco de Horas</span>
    <span><i className="fortnight-legend-swatch fortnight-legend-debit"/> Vermelho: compensação do Banco de Horas</span></>}
    <span><i className="fortnight-legend-swatch fortnight-legend-holiday"/> Verde: feriado</span>
    <span><i className="fortnight-legend-swatch fortnight-legend-today"/> Amarelo: dia atual</span>
   </div>
   <div className="fortnight-actions">
    <div className="subtle">
     {dirtyCurrent.length?dirtyCurrent.length+' dia(s) com alterações não salvas nesta quinzena.':'Nenhuma alteração pendente nesta quinzena.'}
     {dirtyOutside>0?' Há '+dirtyOutside+' alteração(ões) não salvas em outras quinzenas.':''}
    </div>
    <div className="fortnight-action-buttons">
     <button type="button" className="secondary" disabled={saving} onClick={()=>setResetOpen(true)}>
      <RotateCcw size={16}/> Resetar horários
     </button>
     <button type="button" className="primary" disabled={saving||dirtyCurrent.length===0} onClick={()=>void save()}>
      <Save size={17}/>{saving?'Salvando...':'Salvar quinzena'}
     </button>
    </div>
   </div>
   {!trust&&dirtyCurrent.length>0&&previewBank.firstMissingPolicyDate&&
    <p className="error" role="alert">
     Nenhuma política de Banco de Horas vigente em {formatDate(previewBank.firstMissingPolicyDate)}.
    </p>}
   {!trust&&dirtyCurrent.length>0&&previewBank.balanceMinutes<0&&
    <p className="fortnight-negative-notice" role="status">
     Saldo projetado negativo: {formatBankMinutes(previewBank.balanceMinutes)} h.
     As horas devidas serão compensadas pelos próximos créditos no Banco de Horas.
     O salvamento está permitido.
    </p>}
   {resetOpen&&<PayrepConfirmDialog title="Resetar horários da quinzena?"
    description={'Os horários, horas adicionais e marcações de Banco de Horas entre '+formatDate(period.start)+' e '+formatDate(period.end)+' serão zerados, inclusive registros salvos. Comentários e feriados serão preservados.'}
    confirmLabel="Zerar horários" destructive busy={saving}
    onClose={()=>setResetOpen(false)} onConfirm={()=>void resetHours()}/>}
   {message&&<p className="auth-success" role="status">{message}</p>}
   {error&&<p className="error" role="alert">{error}</p>}
  </section>
  <p className="subtle">Base utilizada para os feriados: {baseName}.
   As regras de fechamento e DSR de 16 a 15 permanecem aplicadas às projeções salariais.</p>
  <p className="subtle fortnight-explanation">
   {trust?<>
    Somente jornadas completas registradas entram nos totais. O saldo informativo usa a referência da política vigente ou, na falta dela, 8 horas nos dias úteis; sábados, domingos e feriados não têm jornada de referência.
    Nenhuma marcação nova de banco de horas é gerada. Registros históricos permanecem preservados.
   </>:<>
    Somente jornadas completas entram nos totais de horas trabalhadas.
    Marque Banco de Horas para acumular horas extras ou compensar a jornada.
    Em dias úteis, uma jornada inferior à referência é marcada automaticamente para compensação.
    Um dia sem horários e com o flag marcado representa folga integral.
   </>}
   {dirtyCurrent.length>0?' Os totais incluem alterações ainda não salvas.':''}
  </p>
 </div>
}
