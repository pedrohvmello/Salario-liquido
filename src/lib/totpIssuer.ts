/** Display name in external TOTP apps. Distinct from the authenticator provider label. */
export const PAYREP_TOTP_ISSUER='Payrep'

/**
 * Construct a standards-compatible otpauth:// URI for the QR code.
 * The secret is issued and validated by Supabase. Only the presentation
 * issuer/account label changes; no secret is stored or sent to a QR service.
 */
export function buildPayrepTotpUri(secret:string,account:string){
 const cleanSecret=secret.replace(/\s+/g,'').toUpperCase()
 if(!/^[A-Z2-7]{16,}$/.test(cleanSecret))throw Error('Chave TOTP inválida.')
 const name=account.trim()||'Conta'
 const params=new URLSearchParams({
  secret:cleanSecret,issuer:PAYREP_TOTP_ISSUER,algorithm:'SHA1',digits:'6',period:'30'
 })
 return 'otpauth://totp/'+encodeURIComponent(PAYREP_TOTP_ISSUER)+':'+encodeURIComponent(name)+'?'+params.toString()
}
