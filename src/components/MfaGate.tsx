import {useEffect,useState} from 'react'
import {PayrepSelect} from './PayrepSelect'
import {LockKeyhole,ShieldCheck} from 'lucide-react'
import {db} from '../lib/data'
import {displayMfaLabel} from '../lib/mfaLabels'

type Factor={id:string;name:string}

export function MfaGate({onVerified}:{onVerified:()=>void}){
 const [factors,setFactors]=useState<Factor[]>([])
 const [factorId,setFactorId]=useState('')
 const [code,setCode]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 useEffect(()=>{
  let active=true
  void(async()=>{
   try{
    if(!db)throw Error('Autenticação indisponível.')
    const [factorResult,userResult]=await Promise.all([db.auth.mfa.listFactors(),db.auth.getUser()])
    if(factorResult.error)throw factorResult.error
    const metadata=userResult.error?null:userResult.data.user?.user_metadata
    const verified=factorResult.data.totp.filter(f=>f.status==='verified').map((f,i)=>({id:f.id,name:displayMfaLabel(f.id,f.friendly_name||'Autenticador '+(i+1),metadata)}))
    if(active){setFactors(verified);setFactorId(verified[0]?.id||'')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'Falha ao consultar autenticadores.')}
   finally{if(active)setLoading(false)}
  })()
  return ()=>{active=false}
 },[])
 const submit=async()=>{
  if(!db||!factorId||!/^([0-9]{6})$/.test(code))return
  setBusy(true);setError('')
  try{
   const {error}=await db.auth.mfa.challengeAndVerify({factorId,code})
   if(error)throw error
   const {data:level,error:levelError}=await db.auth.mfa.getAuthenticatorAssuranceLevel()
   if(levelError||level?.currentLevel!=='aal2')throw Error('A validação não elevou a sessão para AAL2.')
   setCode('')
   onVerified()
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível validar o código.')}
  finally{setBusy(false)}
 }
 return <div className="auth-background"><div className="auth-card">
  <ShieldCheck size={35}/>
  <h1>Verificação em dois fatores</h1>
  <p>Digite o código gerado no aplicativo autenticador para acessar os dados financeiros.</p>
  {loading?<p>Carregando autenticadores...</p>:
   factors.length===0?<p className="error" role="alert">Nenhum fator válido foi encontrado. Entre em contato com o suporte ou utilize outra sessão autenticada para recuperar o acesso.</p>:
   <form onSubmit={e=>{e.preventDefault();void submit()}}>
    {factors.length>1&&<label>Autenticador<PayrepSelect value={factorId} onChange={setFactorId} title="Autenticador">{factors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</PayrepSelect></label>}
    <label>Código de 6 dígitos<input type="text" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" autoFocus/></label>
    <button type="submit" className="primary" disabled={busy||code.length!==6}><LockKeyhole size={16}/>{busy?'Verificando...':'Validar código'}</button>
   </form>}
  {error&&<p className="error" role="alert">{error}</p>}
  <button type="button" className="text-button" onClick={()=>void db?.auth.signOut({scope:'local'})}>Sair da conta</button>
  <p className="subtle">Não existem códigos de recuperação no Supabase. Preserve um autenticador de reserva.</p>
 </div></div>
}
