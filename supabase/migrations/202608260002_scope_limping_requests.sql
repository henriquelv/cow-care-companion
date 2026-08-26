-- Solicitações seguem o mesmo escopo da agenda: gerente vê a equipe; funcionário vê novas e próprias.

drop policy if exists "hoof limping request session read" on public.limping_requests;
create policy "hoof limping request session read" on public.limping_requests
for select to anon, authenticated
using (
  public.hoof_session_can_access_farm(farm_id)
  and (
    public.hoof_session_is_admin()
    or created_by = public.hoof_session_employee_id()
    or assigned_employee_id = public.hoof_session_employee_id()
    or status = 'new'
  )
);

drop policy if exists "hoof limping request session update" on public.limping_requests;
create policy "hoof limping request session update" on public.limping_requests
for update to anon, authenticated
using (
  public.hoof_session_can_access_farm(farm_id)
  and (
    public.hoof_session_is_admin()
    or created_by = public.hoof_session_employee_id()
    or assigned_employee_id = public.hoof_session_employee_id()
    or status = 'new'
  )
)
with check (
  public.hoof_session_can_access_farm(farm_id)
  and (
    public.hoof_session_is_admin()
    or created_by = public.hoof_session_employee_id()
    or assigned_employee_id = public.hoof_session_employee_id()
  )
);
