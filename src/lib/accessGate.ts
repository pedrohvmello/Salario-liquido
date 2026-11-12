import type {Membership} from './data'

export type AccessState='checking'|'approved'|'pending'|'suspended'|'rejected'|'error'
export type AccessDecision={userId:string;state:AccessState}

/** Never treat the absence of a completed membership lookup as a denied account. */
export function accessScreenFor(userId:string|null,decision:AccessDecision|null):AccessState{
 if(!userId||!decision||decision.userId!==userId)return 'checking'
 return decision.state
}

export function membershipAccessState(membership:Membership|null):AccessState{
 if(membership?.active===true)return 'approved'
 if(membership?.status==='suspended')return 'suspended'
 if(membership?.status==='rejected')return 'rejected'
 return 'pending'
}
