import {useCallback,useEffect,useState} from 'react'
import {Copy,Gift,Plus,RefreshCw,ShieldCheck} from 'lucide-react'
import {PayrepSelect} from './PayrepSelect'
import {PayrepDatePicker} from './PayrepDatePicker'
import {db} from '../lib/data'

type Promo={
 id:string;codeSuffix:string;plan:'basic'|'full';days:number;
 redeemUntil:string;maxRedemptions:number|null;redeemedCount:number;
 createdAt:string;disabledAt:string|null;
 status:'active'|'expired'|'disabled'|'exhausted'
}
const dateInSP=(date:string)=>new Intl.DateTimeFormat('pt-BR',{
 timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'
}).format(new Date(date))
function calendarDayInSP(value:string){
 return dateInSP(new Date(new Date(value).getTime()-1000).toISOString())
}
const todaySP=()=>{
 const parts=new Intl.DateTimeFormat('en-CA',{
  timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date())
 const map=new Map(parts.map(part=>[part.type,part.value]))
 return [map.get('year'),map.get('month'),map.get('day')].join('-')
}
const futureDefault=()=>{
 const d=new Date(todaySP()+'T12:00:00Z')
 d.setUTCDate(d.getUTCDate()+7)
 return d.toISOString().slice(0,10)
}
export function AdminPromoCodes(){
 const [records,setRecords]=useState<Promo[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [formOpen,setFormOpen]=useState(false)
 const [plan,setPlan]=useState<'basic'|'full'>('full')
 const [days,setDays]=useState('7')
 const [expiry,setExpiry]=useState(futureDefault)
 const [maxUses,setMaxUses]=useState('')
 const [createdCode,setCreatedCode]=useState('')
 const [pendingDisable,setPendingDisable]=useState<string|null>(null)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const reload=useCallback(async()=>{
  if(!db)throw Error('Banco não configurado.')
  const {data,error}=await db.rpc('list_hml_promo_codes')
  if(error)throw error
  if(!Array.isArray(data))throw Error('Resposta inválida ao carregar códigos.')
  setRecords(data as Promo[])
 },[])
 useEffect(()=>{
  let active=true
  void reload().catch(e=>{if(active)setError(e instanceof Error?e.message:'Erro ao consultar códigos promocionais.')})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[reload])
 const create=async()=>{
  if(!db||busy)return
  const count=Number(days)
  if(!Number.isInteger(count)||count<1||count>365){
   setError('Informe um número de dias entre 1 e 365.');return
  }
  if(!expiry||expiry<todaySP()){
   setError('Selecione uma data de expiração válida.');return
  }
  const uses=maxUses.trim()?Number(maxUses):null
  if(uses!==null&&(!Number.isInteger(uses)||uses<1||uses>10000)){
   setError('O limite de resgates deve ser um inteiro entre 1 e 10.000.');return
  }
  setBusy(true);setError('');setMessage('');setCreatedCode('')
  try{
   const {data,error}=await db.rpc('create_hml_promo_code',{
    p_plan:plan,p_days:count,p_last_date:expiry,p_max_redemptions:uses
   })
   if(error)throw error
   if(typeof data?.code!=='string'||!data.code.startsWith('PAY-'))throw Error('O código não foi retornado.')
   setCreatedCode(data.code);setFormOpen(false)
   setMessage('Código criado. Copie-o agora: ele não poderá ser exibido novamente.')
   await reload()
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível criar o código.')}
  finally{setBusy(false)}
 }
 const disable=async(id:string)=>{
  if(!db||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error}=await db.rpc('disable_hml_promo_code',{p_code_id:id})
   if(error)throw error
   if(data?.disabled!==true)throw Error('Não foi possível confirmar a desativação.')
   setPendingDisable(null);setMessage('Código desativado para novos resgates. Acessos já concedidos mantêm sua data final.')
   await reload()
  }catch(e){setError(e instanceof Error?e.message:'Falha ao desativar o código.')}
  finally{setBusy(false)}
 }
 const copy=async()=>{
  if(!createdCode)return
  try{await navigator.clipboard.writeText(createdCode);setMessage('Código copiado. Guarde-o em local seguro.')}
  catch{setMessage('Selecione e copie o código exibido abaixo.')}
 }
 return <section className="panel">
  <div className="panel-heading">
   <h2><Gift size={18}/> Códigos promocionais</h2>
   <div className="row">
    <button className="secondary" type="button" onClick={()=>void reload().catch(e=>setError(String(e)))} disabled={busy||loading}>
     <RefreshCw size={15}/> Atualizar
    </button>
    <button className="primary" type="button" disabled={busy||loading}
     onClick={()=>{setCreatedCode('');setError('');setMessage('');setFormOpen(open=>!open)}}>
     <Plus size={16}/>{formOpen?'Fechar criação':'Criar código'}
    </button>
   </div>
  </div>
  <p className="subtle">Crie períodos gratuitos Basic ou Full sem checkout, cartão ou cobrança. A validade do código limita o prazo para resgate, não os dias de acesso já concedidos.</p>
  {formOpen&&<form className="promo-create-form" onSubmit={event=>{event.preventDefault();void create()}}>
   <div className="promo-create-grid">
    <div className="admin-promo-field"><span>Plano</span>
     <PayrepSelect value={plan} onChange={value=>setPlan(value as 'basic'|'full')} title="Plano do código promocional" disabled={busy}>
      <option value="basic">Basic</option><option value="full">Full</option>
     </PayrepSelect>
    </div>
    <label className="admin-promo-field">Dias de acesso
     <input type="number" min={1} max={365} step={1} required value={days}
      onChange={e=>setDays(e.target.value)} disabled={busy}/>
    </label>
    <div className="admin-promo-field"><span>Último dia para usar o código</span>
     <PayrepDatePicker title="Data de expiração do código" value={expiry}
      onChange={setExpiry} yearSelection minYear={new Date().getFullYear()}
      maxYear={new Date().getFullYear()+2} disabled={busy}/>
    </div>
    <label className="admin-promo-field">Limite de resgates (opcional)
     <input type="number" min={1} max={10000} step={1} value={maxUses}
      placeholder="Ilimitado" onChange={e=>setMaxUses(e.target.value)} disabled={busy}/>
    </label>
   </div>
   <button type="submit" className="primary" disabled={busy||!expiry||!days}>
    {busy?'Criando...':'Gerar código promocional'}
   </button>
  </form>}
  {createdCode&&<div className="promo-created" role="status" aria-live="polite">
   <strong>Código criado, disponível somente agora</strong>
   <div className="row promo-created-row">
    <code>{createdCode}</code>
    <button className="secondary" type="button" onClick={()=>void copy()}><Copy size={16}/> Copiar</button>
   </div>
   <p>Salve o código antes de sair desta tela. Por segurança, o Payrep armazena somente um identificador criptográfico e os quatro últimos caracteres.</p>
  </div>}
  {message&&<p className="auth-success" role="status">{message}</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="table-scroll"><table>
   <thead><tr><th>Código</th><th>Plano</th><th>Dias</th><th>Utilizar até</th><th>Resgates</th><th>Status</th><th>Ação</th></tr></thead>
   <tbody>
    {records.length===0?<tr><td colSpan={7}>Nenhum código promocional criado.</td></tr>:
     records.map(code=><tr key={code.id}>
      <td>•••• {code.codeSuffix}</td>
      <td>{code.plan==='full'?'Full':'Basic'}</td>
      <td>{code.days}</td>
      <td>{calendarDayInSP(code.redeemUntil)}</td>
      <td>{code.redeemedCount}{code.maxRedemptions===null?'':' / '+code.maxRedemptions}</td>
      <td>{code.status==='active'?'Válido':code.status==='disabled'?'Desativado':code.status==='expired'?'Expirado':'Limite atingido'}</td>
      <td>{code.status==='disabled'?'—':pendingDisable===code.id
       ?<span className="row"><button type="button" className="secondary" disabled={busy} onClick={()=>setPendingDisable(null)}>Voltar</button>
        <button type="button" className="secondary" disabled={busy} onClick={()=>void disable(code.id)}>Confirmar</button></span>
       :<button className="secondary" type="button" disabled={busy} onClick={()=>setPendingDisable(code.id)}>Desativar</button>}</td>
     </tr>)}
   </tbody>
  </table></div>
  <p className="subtle"><ShieldCheck size={14}/> Um resgate por código e por usuário; uma promoção ativa por vez. Desativar ou expirar um código não reduz os dias de acesso de quem já o utilizou.</p>
 </section>
}
