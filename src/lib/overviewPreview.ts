/** Identify the HML hostname for features not yet available in the test environment. */
export function isHomologationHost(hostname:string):boolean{
 return hostname==='salario-liquido-hml.vercel.app'||hostname==='payrep-hml.vercel.app'
  ||/^(salario-liquido-hml|payrep-hml)-[a-z0-9-]+\.vercel\.app$/.test(hostname)
}
