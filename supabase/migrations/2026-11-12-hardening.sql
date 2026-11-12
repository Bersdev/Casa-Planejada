-- Endurecimento de segurança (aplicar uma vez no SQL Editor do Supabase)

-- Colunas sensíveis só mudam pelas funções do banco
revoke insert, delete, update on members, households from authenticated;
grant update (name, color) on members to authenticated;
grant update (name, daily_limit, housing_ref_pct, notify_days) on households to authenticated;
revoke insert, update, delete on invites from authenticated;

-- Convite: código maior (12 caracteres) e de uso único
create or replace function create_invite(p_household uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_member(p_household) then raise exception 'forbidden'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into invites (code, household_id, created_by) values (c, p_household, auth.uid());
  return c;
end $$;

create or replace function join_household(p_code text, p_member_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid; n int; palette text[] := array['#f43f5e','#10b981','#f59e0b','#8b5cf6','#06b6d4'];
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from invites where code = upper(trim(p_code)) and expires_at > now() returning household_id into h;
  if h is null then raise exception 'convite inválido ou vencido'; end if;
  select count(*) into n from members where household_id = h;
  insert into members (household_id, user_id, name, color)
    values (h, auth.uid(), left(trim(p_member_name), 60), palette[1 + ((n - 1) % 5)])
    on conflict do nothing;
  return h;
end $$;

-- Fotos de nota: só imagens de até 5 MB
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'] where id = 'receipts';

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
