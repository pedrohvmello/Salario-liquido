-- Additional pilot research candidates only.
-- These are company labels, NOT verified legal entities or applicable agreements.
-- No automatic fetch occurs until a direct official URL is reviewed and enabled.
insert into public.collective_sources(organization,uf,enabled,status,notes)
values
 ('IBM Brasil','SP',false,'awaiting_direct_url','Pesquisar CNPJ/entidade, sindicato, categoria e instrumento aplicável. Sem URL oficial validada.'),
 ('Deloitte Brasil','SP',false,'awaiting_direct_url','Pesquisar CNPJ/entidade, sindicato, categoria e instrumento aplicável. Sem URL oficial validada.'),
 ('Itaú Unibanco','SP',false,'awaiting_direct_url','Pesquisar CNPJ/entidade, sindicato, categoria e instrumento aplicável. Sem URL oficial validada.'),
 ('Mercado Livre','SP',false,'awaiting_direct_url','Pesquisar CNPJ/entidade, sindicato, categoria e instrumento aplicável. Sem URL oficial validada.')
on conflict do nothing;