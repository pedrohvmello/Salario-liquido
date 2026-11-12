import {describe,expect,it} from 'vitest'
import {mfaGateForAssurance} from './mfaAssurance'
describe('2FA session gate',()=>{
 it('permits a session with no enrolled factors',()=>expect(mfaGateForAssurance({currentLevel:'aal1',nextLevel:'aal1'})).toBe('ready'))
 it('blocks a session that needs second factor',()=>expect(mfaGateForAssurance({currentLevel:'aal1',nextLevel:'aal2'})).toBe('challenge'))
 it('allows verified AAL2',()=>expect(mfaGateForAssurance({currentLevel:'aal2',nextLevel:'aal2'})).toBe('ready'))
 it('fails closed when status is unavailable',()=>{expect(mfaGateForAssurance(null)).toBe('error');expect(mfaGateForAssurance({currentLevel:'aal2',nextLevel:'aal2'},new Error('offline'))).toBe('error')})
})
