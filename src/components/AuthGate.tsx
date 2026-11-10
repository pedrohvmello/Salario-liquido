import {useState} from 'react'
import {ChevronRight, LockKeyhole, ShieldCheck} from 'lucide-react'
import {db} from '../lib/data'

/** Official-style multicolor Google G mark for the OAuth button. */
function GoogleGIcon(){
 return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={20} height={20} aria-hidden="true" focusable="false">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.75 7.18l7.73 6C44.43 38.03 46.98 31.87 46.98 24.55z"/>
  <path fill="#FBBC05" d="M10.53 28.59C10.05 27.13 9.78 25.59 9.78 24s.27-3.13.75-4.59l-7.98-6.2C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.92-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.19 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
 </svg>
}

export function AuthGate(){
  const [mode,setMode]=useState<'login'|'reset'|'signup'>('login')
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
      }else if(mode==='signup'){
        const {data,error}=await db.auth.signUp({email:email.trim(),password})
        if(error)throw error
        if(!data.session)setMessage('Solicitação recebida. Se o cadastro for permitido, confira o e-mail para confirmar sua conta. O acesso poderá depender de aprovação administrativa.')
        else setMessage('Conta criada. O aplicativo verificará sua autorização de acesso.')
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
    <div className="brand auth-brand brand--wordmark">
      <div className="brand-type"><strong>Payrep</strong><small>Controle salarial</small></div>
    </div>
    <h1>{mode==='reset'?'Recuperar senha':mode==='signup'?'Criar uma conta':'Acesse sua conta'}</h1>
    <p>{mode==='reset'?'Informe o e-mail de sua conta. O link de recuperação abrirá esta aplicação.':mode==='signup'?'Cadastre-se para solicitar acesso. Conforme a política administrativa, sua conta poderá exigir aprovação.':'Seus holerites e registros ficam privados e vinculados à sua conta.'}</p>
    <form onSubmit={e=>{e.preventDefault();void act()}}>
      <label>E-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label>
      {mode!=='reset'&&<label>Senha<input type="password" required minLength={mode==='signup'?8:6} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='signup'?'Mínimo de 8 caracteres':'Sua senha'}/></label>}
      <button className="primary" disabled={busy} type="submit">{mode==='reset'?'Enviar link de recuperação':mode==='signup'?'Solicitar cadastro':'Entrar'} <ChevronRight size={17}/></button>
      {error&&<p className="error" role="alert">{error}</p>}
      {message&&<p className="auth-success" role="status">{message}</p>}
    </form>
    {mode!=='reset'&&googleEnabled&&<><div className="auth-separator">ou</div><button type="button" className="secondary google-sign-in" onClick={()=>{void googleSignIn()}} disabled={busy}><GoogleGIcon/> Continuar com Google</button></>}
    <div className="auth-bottom-actions">
      {mode==='login'&&<button className="text-button" type="button" onClick={()=>{setMode('signup');setError('');setMessage('')}}>Criar conta</button>}
      <button className="text-button" type="button" onClick={()=>{setMode(mode==='login'?'reset':'login');setError('');setMessage('')}}>
        <LockKeyhole size={15}/>{mode==='login'?'Esqueci minha senha':'Voltar ao login'}
      </button>
    </div>
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
