import {useState} from 'react'
import {ChevronRight, LockKeyhole, ShieldCheck, Wallet} from 'lucide-react'
import {db} from '../lib/data'

export function AuthGate(){
  const [mode,setMode]=useState<'login'|'reset'>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const act=async()=>{
    if(!db)return
    setBusy(true);setError('');setMessage('')
    try{
      if(mode==='reset'){
        const {error}=await db.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin})
        if(error)throw error
        setMessage('Se a conta existir, você receberá instruções para recuperar a senha.')
      }else{
        const {error}=await db.auth.signInWithPassword({email:email.trim(),password})
        if(error)throw error
      }
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir a solicitação.')}
    finally{setBusy(false)}
  }
  const googleEnabled=import.meta.env.VITE_ENABLE_GOOGLE_OAUTH==='true'
  const googleSignIn=async()=>{
    if(!db)return
    setBusy(true);setError('');setMessage('')
    try{
      const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}})
      if(error)throw error
    }catch(e){setError(e instanceof Error?e.message:'Falha ao iniciar o login Google.');setBusy(false)}
  }
  return <div className="auth-background"><div className="auth-card">
    <div className="brand auth-brand"><div className="brandmark"><Wallet size={24}/></div>
      <div><strong>Salário Líquido</strong><small>Gestão salarial pessoal</small></div>
    </div>
    <h1>{mode==='reset'?'Recuperar senha':'Acesse sua conta'}</h1>
    <p>{mode==='reset'?'Informe o e-mail de sua conta. O link de recuperação abrirá esta aplicação.':'Seus holerites e registros ficam privados. Contas são habilitadas apenas por convite.'}</p>
    <form onSubmit={e=>{e.preventDefault();void act()}}>
      <label>E-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label>
      {mode==='login'&&<label>Senha<input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha"/></label>}
      <button className="primary" disabled={busy} type="submit">{mode==='reset'?'Enviar link de recuperação':'Entrar'} <ChevronRight size={17}/></button>
      {error&&<p className="error" role="alert">{error}</p>}
      {message&&<p className="auth-success" role="status">{message}</p>}
    </form>
    {mode==='login'&&googleEnabled&&<><div className="auth-separator">ou</div><button type="button" className="secondary google-sign-in" onClick={()=>{void googleSignIn()}} disabled={busy}><span className="google-g">G</span> Continuar com Google</button></>}
    <button className="text-button" type="button" onClick={()=>{setMode(mode==='login'?'reset':'login');setError('');setMessage('')}}>
      <LockKeyhole size={15}/>{mode==='login'?'Esqueci minha senha':'Voltar ao login'}
    </button>
    <div className="secure"><ShieldCheck size={16}/> Acesso individual com autenticação</div>
  </div></div>
}

export function ChangePassword({onComplete}:{onComplete?:()=>void}={}){
  const [password,setPassword]=useState('')
  const [confirmation,setConfirmation]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  async function update(){
    if(!db)return
    setError('');setMessage('')
    if(password.length<8){setError('A senha deve ter pelo menos 8 caracteres.');return}
    if(password!==confirmation){setError('As senhas informadas são diferentes.');return}
    setBusy(true)
    try{
      const {error}=await db.auth.updateUser({password})
      if(error)throw error
      setPassword('');setConfirmation('');setMessage('Senha definida com sucesso.')
      onComplete?.()
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar a senha.')}
    finally{setBusy(false)}
  }
  return <form className="form" onSubmit={e=>{e.preventDefault();void update()}}>
    <p className="subtle">Após aceitar seu convite, defina uma senha nesta área. Ela também pode ser alterada posteriormente.</p>
    <label>Nova senha<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>Confirme a nova senha<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
    {error&&<p role="alert" className="error">{error}</p>}
    {message&&<p role="status" className="auth-success">{message}</p>}
    <button type="submit" disabled={!db||busy} className="primary"><LockKeyhole size={16}/> Definir senha</button>
  </form>
}
