/** Checkout billing name: distinguish legal full names from display nicknames. */
export function normalizeCheckoutName(value:string):string{
 return value.trim().replace(/\s+/g,' ')
}
export function isValidCheckoutName(value:string):boolean{
 const name=normalizeCheckoutName(value)
 if(name.length<5||name.length>100)return false
 const tokens=name.split(' ')
 return tokens.length>=2&&tokens.every(token=>
  /^[\p{L}][\p{L}'’.-]*$/u.test(token)&&token.replace(/[^\p{L}]/gu,'').length>=2)
}
