import {useEffect,useRef,useState} from 'react'
import {PayrepSelect} from './PayrepSelect'
import type {User} from '@supabase/supabase-js'
import {ArrowLeft,Save,MapPin,UserRound,Info,CheckCircle2,AlertTriangle} from 'lucide-react'
import {blankProfile,loadMyProfile,saveMyProfile,type PayrepProfile} from '../lib/account'
import {formatCep,formatPhone,onlyDigits,isValidCepResult,type CepResult} from '../lib/profileInput'

const fields:{key:keyof PayrepProfile;label:string;placeholder?:string;max:number}[]=[
 {key:'phone',label:'Telefone com DDD',placeholder:'(11) 99999-9999',max:30},
 {key:'postal_code',label:'CEP',placeholder:'00000-000',max:20},
 {key:'street',label:'Logradouro',placeholder:'Rua, avenida, alameda...',max:160},
 {key:'street_number',label:'Número',max:24},
 {key:'complement',label:'Complemento',placeholder:'Apartamento, bloco...',max:100},
 {key:'neighborhood',label:'Bairro',max:100},
 {key:'city',label:'Cidade',max:100},
 {key:'state',label:'Estado / UF',placeholder:'SP',max:80},
 {key:'country',label:'País',max:80}
]
function InputField({field,value,onChange}:{field:typeof fields[number];value:string;onChange:(value:string)=>void}){
 return <label>{field.label}<input type={field.key==='phone'?'tel':'text'} inputMode={field.key==='postal_code'?'numeric':field.key==='phone'?'tel':'text'} maxLength={field.max} value={value} placeholder={field.placeholder||''} onChange={e=>onChange(e.target.value)}/></label>
}
export function ProfilePage({user,onBack}:{user:User;onBack:()=>void}){
 const [value,setValue]=useState<PayrepProfile>(()=>blankProfile(user))
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [cepStatus,setCepStatus]=useState('')
 const lastQueriedCep=useRef('')
 useEffect(()=>{
  let active=true
  void loadMyProfile().then(data=>{if(active){lastQueriedCep.current=onlyDigits(data.postal_code);setValue({...data,phone:formatPhone(data.phone),postal_code:formatCep(data.postal_code)});setError('')}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Falha ao carregar o cadastro.')})
   .finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[user.id])
 useEffect(()=>{
  if(loading)return
  const cep=onlyDigits(value.postal_code)
  if(cep.length!==8||cep===lastQueriedCep.current){if(cep.length!==8)setCepStatus('');return}
  const controller=new AbortController()
  const timer=window.setTimeout(()=>{
   lastQueriedCep.current=cep
   setCepStatus('Consultando CEP...')
   void fetch('https://viacep.com.br/ws/'+cep+'/json/',{signal:controller.signal})
    .then(async res=>{if(!res.ok)throw Error('Serviço de CEP indisponível.');return await res.json() as CepResult})
    .then(address=>{
     if(!isValidCepResult(address)){setCepStatus('CEP não encontrado. Preencha o endereço manualmente.');return}
     setValue(prev=>{
      if(onlyDigits(prev.postal_code)!==cep)return prev
      return {...prev,street:address.logradouro||prev.street,
       neighborhood:address.bairro||prev.neighborhood,city:address.localidade||prev.city,
       state:address.uf||prev.state,country:'Brasil'}
     })
     setCepStatus('Endereço localizado. Confira número e complemento.')
    })
    .catch(err=>{if((err as {name?:string}).name!=='AbortError')setCepStatus('Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.')})
  },350)
  return ()=>{window.clearTimeout(timer);controller.abort()}
 },[value.postal_code,loading])
 const patch=(key:keyof PayrepProfile,v:string)=>setValue(prev=>({...prev,[key]:v}))
 const save=async()=>{
  setBusy(true);setError('');setMessage('')
  try{const updated=await saveMyProfile(value);setValue(updated);setMessage('Dados cadastrais salvos com sucesso.')}
  catch(e){setError(e instanceof Error?e.message:'Falha ao salvar os dados.')}
  finally{setBusy(false)}
 }
 return <div className="stack account-page">
  <div className="page-intro"><div><h2>Meu cadastro</h2><p>Atualize seu nome, telefone e endereço. O e-mail é administrado pelo login.</p></div><button type="button" className="secondary" onClick={onBack}><ArrowLeft size={16}/> Voltar</button></div>
  {loading?<div className="panel">Carregando seu cadastro...</div>:<form className="stack" onSubmit={e=>{e.preventDefault();void save()}}>
   <section className="panel"><div className="panel-heading"><h2><UserRound size={17}/> Dados pessoais</h2></div>
    <div className="account-form-grid">
     <label className="account-field-wide">Nome completo<input type="text" autoComplete="name" maxLength={100} value={value.display_name} onChange={e=>patch('display_name',e.target.value)} required/></label>
     <label>E-mail<input type="email" value={user.email||''} readOnly className="account-readonly"/></label>
     <InputField field={fields[0]} value={value.phone} onChange={s=>patch('phone',formatPhone(s))}/>
    </div>
   </section>
   <section className="panel"><div className="panel-heading"><h2><MapPin size={17}/> Endereço</h2></div>
    <div className="account-form-grid">
     {fields.slice(1).map(field=><div key={field.key}><InputField field={field} value={value[field.key]} onChange={s=>patch(field.key,field.key==='postal_code'?formatCep(s):s)}/>{field.key==='postal_code'&&cepStatus&&<small className="cep-lookup-status" role="status">{cepStatus}</small>}</div>)}
    </div>
    <div className="detail-hint"><Info size={16}/>Informações utilizadas para cadastro e futura cobrança, quando um serviço de pagamentos for habilitado. Nenhum pagamento é realizado nesta tela.</div>
   </section>
   <section className="panel"><div className="panel-heading"><h2><Info size={17}/> Dados bancários</h2></div>
    <p className="subtle">Seção em preparação. Para sua segurança, os dados bancários ainda não são solicitados nem armazenados.</p>
    <fieldset disabled className="bank-details-placeholder" aria-label="Dados bancários indisponíveis nesta versão">
     <div className="account-form-grid">
      <label>Banco<input type="text" placeholder="Código e nome do banco"/></label>
      <label>Tipo de conta<PayrepSelect defaultValue="" title="Tipo de conta"><option value="">Selecione</option><option>Corrente</option><option>Poupança</option></PayrepSelect></label>
      <label>Agência<input type="text" placeholder="Número da agência"/></label>
      <label>Conta e dígito<input type="text" placeholder="Número da conta"/></label>
      <label className="account-field-wide">Titular da conta<input type="text" placeholder="Nome do titular"/></label>
      <label className="account-field-wide">Chave Pix (opcional)<input type="text" placeholder="Chave Pix"/></label>
     </div>
    </fieldset>
    <div className="detail-hint"><Info size={16}/>O armazenamento exigirá tabela específica com acesso restrito por usuário. Não digite dados bancários nesta versão.</div>
   </section>
   <div className="account-save-action"><button type="submit" className="primary" disabled={busy}><Save size={16}/>{busy?'Salvando...':'Salvar dados cadastrais'}</button>
    <div className="account-save-feedback">
     {message&&<div className="notice success payrep-feedback-toast" role="status" aria-live="polite"><CheckCircle2 size={18} aria-hidden="true"/><span>{message}</span><button type="button" onClick={()=>setMessage('')} aria-label="Fechar confirmação">Fechar</button></div>}
     {error&&<div className="notice danger payrep-feedback-toast" role="alert"><AlertTriangle size={18} aria-hidden="true"/><span>{error}</span><button type="button" onClick={()=>setError('')} aria-label="Fechar erro">Fechar</button></div>}
    </div>
   </div>
  </form>}
 </div>
}
