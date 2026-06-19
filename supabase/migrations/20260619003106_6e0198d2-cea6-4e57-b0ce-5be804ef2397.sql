create or replace function public.normalize_invite_code(p_code text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.find_group_by_invite_code(p_code text)
returns table (
  id uuid, name text, description text, type text, visibility text,
  join_method text, cover_url text, icon_url text, member_count integer
)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.description, g.type::text, g.visibility::text,
         g.join_method::text, g.cover_url, g.icon_url, g.member_count
  from public.groups g
  where g.invite_code is not null
    and public.normalize_invite_code(g.invite_code) = public.normalize_invite_code(p_code)
  limit 1
$$;

grant execute on function public.normalize_invite_code(text) to authenticated, anon;
grant execute on function public.find_group_by_invite_code(text) to authenticated, anon;

create or replace function public.join_group_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_group public.groups%rowtype;
  v_existing public.group_members%rowtype;
  v_status text;
begin
  if v_user is null then
    return jsonb_build_object('status', 'error', 'message', 'Not authenticated');
  end if;

  select * into v_group from public.groups
  where invite_code is not null
    and public.normalize_invite_code(invite_code) = public.normalize_invite_code(p_code)
  limit 1;

  if not found then
    return jsonb_build_object('status', 'not_found', 'message', 'Invalid invite code');
  end if;

  select * into v_existing from public.group_members
  where group_id = v_group.id and user_id = v_user limit 1;

  if found then
    if v_existing.status = 'active' then
      return jsonb_build_object('status', 'already_member', 'group_id', v_group.id, 'group_name', v_group.name);
    elsif v_existing.status = 'banned' then
      return jsonb_build_object('status', 'banned', 'message', 'You have been banned from this group');
    elsif v_existing.status = 'pending' then
      return jsonb_build_object('status', 'pending', 'group_id', v_group.id, 'group_name', v_group.name);
    end if;
  end if;

  -- Invite codes bypass invite_only (the code IS the invite).
  if v_group.join_method::text = 'request_to_join' then
    v_status := 'pending';
  else
    v_status := 'active';
  end if;

  if v_existing.id is not null then
    update public.group_members set status = v_status where id = v_existing.id;
  else
    insert into public.group_members (group_id, user_id, role, status)
    values (v_group.id, v_user, 'member', v_status);
  end if;

  return jsonb_build_object(
    'status', case when v_status = 'active' then 'joined' else 'pending' end,
    'group_id', v_group.id,
    'group_name', v_group.name
  );
end;
$$;

grant execute on function public.join_group_by_code(text) to authenticated;