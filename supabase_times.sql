-- ============================================================
--  Hapvida Learn — Academia de Vendas · Times self-service (v3)
--  Rodar TUDO no SQL Editor do Supabase. Idempotente.
--  Requer o schema v2 (equipes, codigos_acesso, perfis, meu_papel(), minha_equipe()).
--  Permite: supervisor cria/gerencia o PRÓPRIO time; gerente/diretor criam qualquer time.
-- ============================================================

-- 1) leitura dos códigos pelos gestores (para exibir o código do time no painel)
drop policy if exists codigos_sel on codigos_acesso;
create policy codigos_sel on codigos_acesso for select using (
  meu_papel() in ('gerente','diretor')
  or (meu_papel()='supervisor' and equipe_id = minha_equipe())
);

-- 2) gerador de código aleatório único (VEND1234, SUP1234, ...)
create or replace function _novo_codigo(prefixo text)
returns text language plpgsql security definer set search_path=public as $$
declare c text;
begin
  loop
    c := upper(prefixo) || to_char((random()*9999)::int, 'FM0000');
    exit when not exists (select 1 from codigos_acesso where codigo = c);
  end loop;
  return c;
end $$;

-- 3) criar equipe
--    - supervisor: cria e ASSUME a equipe (passa a liderá-la) + gera código de vendedor
--    - gerente/diretor: cria a equipe (sem trocar a própria) + gera código de vendedor
create or replace function criar_equipe(p_nome text)
returns json language plpgsql security definer set search_path=public as $$
declare pap text; eid uuid; cod text; unome text;
begin
  pap := meu_papel();
  if pap is null or pap not in ('supervisor','gerente','diretor') then
    raise exception 'Sem permissão para criar equipe';
  end if;
  if coalesce(trim(p_nome),'') = '' then raise exception 'Informe o nome da equipe'; end if;
  select nome into unome from perfis where id = auth.uid();
  insert into equipes (nome, gerente_nome) values (trim(p_nome), unome) returning id into eid;
  cod := _novo_codigo('VEND');
  insert into codigos_acesso (codigo, equipe_id, papel) values (cod, eid, 'vendedor');
  if pap = 'supervisor' then
    update perfis set equipe_id = eid where id = auth.uid();
  end if;
  return json_build_object('equipe_id', eid, 'codigo_vendedor', cod, 'nome', trim(p_nome));
end $$;

-- 4) gerar um código adicional para uma equipe
--    - gerente/diretor: qualquer equipe e qualquer papel
--    - supervisor: só a própria equipe e só papel 'vendedor'
create or replace function gerar_codigo(p_equipe_id uuid, p_papel text default 'vendedor')
returns text language plpgsql security definer set search_path=public as $$
declare pap text; cod text; pref text;
begin
  pap := meu_papel();
  if pap in ('gerente','diretor') then
    null; -- pode tudo
  elsif pap = 'supervisor' then
    if p_equipe_id is distinct from minha_equipe() then raise exception 'Só a sua equipe'; end if;
    if p_papel <> 'vendedor' then raise exception 'Supervisor só gera código de vendedor'; end if;
  else
    raise exception 'Sem permissão';
  end if;
  if p_papel not in ('vendedor','supervisor','gerente','diretor') then raise exception 'Papel inválido'; end if;
  pref := case p_papel when 'vendedor' then 'VEND' when 'supervisor' then 'SUP' when 'gerente' then 'GER' else 'DIR' end;
  cod := _novo_codigo(pref);
  insert into codigos_acesso (codigo, equipe_id, papel) values (cod, p_equipe_id, p_papel);
  return cod;
end $$;

-- 5) contagem de membros por equipe (para o painel; respeita o papel do chamador)
create or replace function equipes_resumo()
returns table(equipe_id uuid, nome text, gerente_nome text, vendedores int, codigo_vendedor text)
language sql security definer set search_path=public as $$
  select e.id, e.nome, e.gerente_nome,
    (select count(*) from perfis pf where pf.equipe_id = e.id and pf.papel='vendedor')::int,
    (select ca.codigo from codigos_acesso ca where ca.equipe_id = e.id and ca.papel='vendedor' and ca.ativo order by ca.codigo limit 1)
  from equipes e
  where meu_papel() in ('gerente','diretor')
     or (meu_papel()='supervisor' and e.id = minha_equipe());
$$;

notify pgrst, 'reload schema';
