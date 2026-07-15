-- ============================================================
--  Hapvida Learn — Cadastros incompletos (v4)
--  Rodar TUDO no SQL Editor do Supabase. Idempotente.
--  Requer o schema v2 (perfis, meu_papel()).
--  Lista quem criou LOGIN (auth.users) mas NÃO concluiu o cadastro
--  (não tem perfil — faltou código da equipe ou confirmação de e-mail).
--  Só gerente/diretor recebem resultado.
-- ============================================================
create or replace function cadastros_incompletos()
returns table(id uuid, email text, criado_em timestamptz, confirmado boolean)
language sql security definer set search_path = public as $$
  select u.id,
         u.email::text,
         u.created_at,
         (u.email_confirmed_at is not null) as confirmado
  from auth.users u
  left join public.perfis p on p.id = u.id
  where p.id is null
    and public.meu_papel() in ('gerente','diretor')
  order by u.created_at desc;
$$;

grant execute on function cadastros_incompletos() to anon, authenticated;
notify pgrst, 'reload schema';
