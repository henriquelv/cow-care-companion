-- Permite corrigir uma solicitação enviada por engano sem liberar exclusões de terceiros.

drop policy if exists "hoof limping request session delete" on public.limping_requests;
create policy "hoof limping request session delete" on public.limping_requests
for delete to anon, authenticated
using (
  public.hoof_session_can_access_farm(farm_id)
  and (
    public.hoof_session_is_admin()
    or created_by = public.hoof_session_employee_id()
  )
);
