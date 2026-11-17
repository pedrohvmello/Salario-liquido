import {useState} from 'react'
import {ArrowRight,UserRound} from 'lucide-react'
import type {PayrepProfile} from '../lib/account'
import {cpfDigits,formatCpf,isValidCpf} from '../lib/brazilIdentity'
import {isValidCheckoutName} from '../lib/checkoutPayerName'
import {formatCep,formatPhone} from '../lib/profileInput'

type Props={
 planName:string
 initial:PayrepProfile
 busy:boolean
 onCancel:()=>void
 onContinue:(profile:PayrepProfile)=>Promise<void>
}
const labels:{key:keyof PayrepProfile;label:string;maxlength:number;required?:boolean}[]=[
 {key:'display_name',label:'Nome completo',maxlength:100,required:true},
 {key:'cpf',label:'CPF',maxlength:14,required:true},
 {key:'phone',label:'Celular com DDD',maxlength:30},
 {key:'postal_code',label:'CEP',maxlength:9},
 {key:'street',label:'Endereço',maxlength:160},
 {key:'street_number',label:'Número',maxlength:24},
 {key:'complement',label:'Complemento',maxlength:100},
 {key:'neighborhood',label:'Bairro',maxlength:100},
 {key:'city',label:'Cidade',maxlength:100},
 {key:'state',label:'UF',maxlength:2},
 {key:'country',label:'País',maxlength:80}
]
export function CheckoutPayerReview({planName,initial,busy,onCancel,onContinue}:Props){
 const [profile,setProfile]=useState<PayrepProfile>({
  ...initial,cpf:formatCpf(initial.cpf),phone:formatPhone(initial.phone),
  postal_code:formatCep(initial.postal_code)
 })
 const [error,setError]=useState('')
 const patch=(key:keyof PayrepProfile,raw:string)=>{
  const value=key==='cpf'?formatCpf(raw)
   :key==='postal_code'?formatCep(raw)
   :key==='phone'?formatPhone(raw):raw
  setProfile(previous=>({...previous,[key]:value}))
  setError('')
 }
 const submit=async()=>{
  if(!isValidCheckoutName(profile.display_name)){
   setError('Informe seu nome e sobrenome completos, como aparecem no documento.')
   return
  }
  if(!isValidCpf(profile.cpf)){
   setError('Informe um CPF válido para continuar.')
   return
  }
  setError('')
  try{await onContinue(profile)}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar o checkout.')}
 }
 return <section className="panel checkout-review-panel" aria-labelledby="checkout-review-title">
  <div className="panel-heading"><h2 id="checkout-review-title"><UserRound size={18}/> Revisar dados para contratar {planName}</h2></div>
  <p className="subtle">Confira ou altere seus dados antes de continuar. As informações serão salvas em Meu cadastro e enviadas ao Asaas. No checkout hospedado, os campos preenchidos pelo Payrep podem ficar bloqueados para edição.</p>
  <form className="checkout-review-form" onSubmit={event=>{event.preventDefault();void submit()}}>
   <div className="account-form-grid">
    {labels.map(field=><label key={field.key}>{field.label}
     <input
      value={profile[field.key]||''}
      onChange={event=>patch(field.key,event.target.value)}
      maxLength={field.maxlength}
      required={field.required}
      autoComplete={field.key==='display_name'?'name':field.key==='phone'?'tel':field.key==='postal_code'?'postal-code':'off'}
      inputMode={field.key==='cpf'||field.key==='postal_code'?'numeric':field.key==='phone'?'tel':'text'}
      aria-invalid={field.key==='cpf'&&cpfDigits(profile.cpf).length===11&&!isValidCpf(profile.cpf)}
      placeholder={field.key==='cpf'?'000.000.000-00':field.key==='postal_code'?'00000-000':''}
     />
    </label>)}
   </div>
   {error&&<p role="alert" className="error">{error}</p>}
   <p className="subtle">O endereço pode ser ajustado aqui. O CPF é necessário para contratar, mas a data de nascimento permanece opcional. Os dados do cartão serão solicitados apenas no Asaas.</p>
   <div className="row subscription-cpf-actions">
    <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
    <button type="submit" className="primary" disabled={busy||!isValidCpf(profile.cpf)||!isValidCheckoutName(profile.display_name)}>
     {busy?'Preparando checkout...':<>Salvar e continuar no Asaas <ArrowRight size={16}/></>}
    </button>
   </div>
  </form>
 </section>
}
