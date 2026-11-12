/**
 * OAuth providers and password recovery can temporarily return data in a URL
 * fragment. Remove only a trailing empty fragment once Auth has initialized;
 * never strip a non-empty fragment containing authentication parameters.
 */
export function pathnameWithoutEmptyFragment(href:string):string|null{
 if(!href.endsWith('#'))return null
 try{
  const url=new URL(href)
  return url.pathname+url.search
 }catch{return null}
}
