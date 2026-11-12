import {describe,it,expect,vi} from 'vitest'
import {verifyThenChangePassword,type PasswordVerifier,type PasswordUpdater} from './currentPasswordVerification'

const identity={id:'user-123',email:'test@example.invalid'}
const correctPassword='ExampleCurrent123!'
const nextPassword='ExampleNext123!!'

function mocks({loginError=null,userId=identity.id,session=true,revokeError=null}:{
 loginError?:{message:string;status?:number}|null;userId?:string;
 session?:boolean;revokeError?:{message:string}|null
}={}){
 const signInWithPassword=vi.fn(async()=>({
  data:{user:userId?{id:userId}:null,session:session?{access_token:'temporary'}:null},
  error:loginError
 }))
 const signOut=vi.fn(async()=>({error:revokeError}))
 const updateUser=vi.fn(async()=>({error:null}))
 const verifier={auth:{signInWithPassword,signOut}} as PasswordVerifier
 const updater={updateUser} as PasswordUpdater
 return {verifier,updater,signInWithPassword,signOut,updateUser}
}

describe('password change with current-password verification',()=>{
 it('refuses wrong current password without calling updateUser',async()=>{
  const m=mocks({loginError:{message:'Invalid login credentials',status:400},session:false})
  await expect(verifyThenChangePassword(identity,'wrong',nextPassword,m.verifier,m.updater))
   .rejects.toThrow('Senha atual incorreta.')
  expect(m.updateUser).not.toHaveBeenCalled()
  expect(m.signOut).not.toHaveBeenCalled()
 })
 it('validates password, revokes temporary session, then changes password',async()=>{
  const m=mocks()
  await verifyThenChangePassword(identity,correctPassword,nextPassword,m.verifier,m.updater)
  expect(m.signInWithPassword).toHaveBeenCalledWith({email:identity.email,password:correctPassword})
  expect(m.signOut).toHaveBeenCalledWith({scope:'local'})
  expect(m.updateUser).toHaveBeenCalledWith({current_password:correctPassword,password:nextPassword})
  expect(m.signOut.mock.invocationCallOrder[0]).toBeLessThan(m.updateUser.mock.invocationCallOrder[0])
 })
 it('refuses a session for another user',async()=>{
  const m=mocks({userId:'another-user'})
  await expect(verifyThenChangePassword(identity,correctPassword,nextPassword,m.verifier,m.updater))
   .rejects.toThrow('Não foi possível confirmar')
  expect(m.signOut).toHaveBeenCalled()
  expect(m.updateUser).not.toHaveBeenCalled()
 })
 it('fails closed if temporary session cannot be revoked',async()=>{
  const m=mocks({revokeError:{message:'network failure'}})
  await expect(verifyThenChangePassword(identity,correctPassword,nextPassword,m.verifier,m.updater))
   .rejects.toThrow('Não foi possível finalizar a validação')
  expect(m.updateUser).not.toHaveBeenCalled()
 })
 it('fails if current password is missing or matches new password',async()=>{
  const m=mocks()
  await expect(verifyThenChangePassword(identity,'',nextPassword,m.verifier,m.updater))
   .rejects.toThrow('Informe a senha atual')
  await expect(verifyThenChangePassword(identity,nextPassword,nextPassword,m.verifier,m.updater))
   .rejects.toThrow('deve ser diferente')
  expect(m.signInWithPassword).not.toHaveBeenCalled()
  expect(m.updateUser).not.toHaveBeenCalled()
 })
 it('never calls updateUser when login is rate limited',async()=>{
  const m=mocks({loginError:{message:'Too Many Requests',status:429},session:false})
  await expect(verifyThenChangePassword(identity,'wrong',nextPassword,m.verifier,m.updater))
   .rejects.toThrow('Não foi possível validar')
  expect(m.updateUser).not.toHaveBeenCalled()
 })
})
