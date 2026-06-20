
CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_group public.groups%rowtype;
  v_existing public.group_members%rowtype;
begin
  if v_user is null then
    return jsonb_build_object('status', 'error', 'message', 'Not authenticated');
  end if;

  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('status', 'not_found', 'message', 'Invalid invite code');
  end if;

  select * into v_group
  from public.groups
  where invite_code is not null
    and public.normalize_invite_code(invite_code) = public.normalize_invite_code(p_code)
  limit 1;

  if not found then
    return jsonb_build_object('status', 'not_found', 'message', 'Invalid invite code');
  end if;

  select * into v_existing
  from public.group_members
  where group_id = v_group.id and user_id = v_user
  limit 1;

  if found then
    if v_existing.status = 'banned' then
      return jsonb_build_object(
        'status', 'banned',
        'message', 'You have been banned from this group'
      );
    elsif v_existing.status = 'active' then
      return jsonb_build_object(
        'status', 'already_member',
        'group_id', v_group.id,
        'group_name', v_group.name
      );
    else
      -- pending/removed -> promote to active (invite code is pre-approval)
      update public.group_members
         set status = 'active', role = coalesce(role, 'member')
       where id = v_existing.id;
      return jsonb_build_object(
        'status', 'joined',
        'group_id', v_group.id,
        'group_name', v_group.name
      );
    end if;
  end if;

  -- Invite codes always grant active membership, regardless of join_method.
  insert into public.group_members (group_id, user_id, role, status)
  values (v_group.id, v_user, 'member', 'active');

  return jsonb_build_object(
    'status', 'joined',
    'group_id', v_group.id,
    'group_name', v_group.name
  );
end;
$function$;
