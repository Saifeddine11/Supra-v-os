-- Team module: finance role, employee archive, self-update safety, financial RLS for finance role

-- 1) Enum value (idempotent)
alter type user_role add value if not exists 'finance';

-- 2) Archive timestamp (soft lifecycle; distinct from is_active workload flag)
alter table public.employees
  add column if not exists archived_at timestamptz;

comment on column public.employees.archived_at is 'When set, member is archived (hidden from assignation lists by default).';

create index if not exists idx_employees_archived on public.employees (archived_at);

-- 3) Prevent non-admins from escalating privileges via self-update
create or replace function public.employees_enforce_update_rls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role user_role;
begin
  select e.role into actor_role
  from public.employees e
  where e.user_id = auth.uid()
  limit 1;

  if actor_role = 'admin' then
    return new;
  end if;

  if old.user_id is null or old.user_id <> auth.uid() then
    raise exception 'Mise à jour non autorisée' using errcode = '42501';
  end if;

  -- Self: only non-sensitive fields
  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email
     or new.user_id is distinct from old.user_id
     or new.archived_at is distinct from old.archived_at
     or new.notes_internal is distinct from old.notes_internal
     or new.full_name is distinct from old.full_name
     or new.hire_date is distinct from old.hire_date
     or new.manager_id is distinct from old.manager_id
  then
    raise exception 'Seuls les administrateurs peuvent modifier ces champs.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists employees_enforce_update_rls on public.employees;
create trigger employees_enforce_update_rls
  before update on public.employees
  for each row
  execute function public.employees_enforce_update_rls();

-- 4) Financial policies: grant finance same access pattern as commercial where applicable

drop policy if exists "invoices_select_financial" on invoices;
create policy "invoices_select_financial"
  on invoices for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

drop policy if exists "invoices_modify_financial" on invoices;
create policy "invoices_modify_financial"
  on invoices for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

drop policy if exists "invoice_items_select" on invoice_items;
create policy "invoice_items_select"
  on invoice_items for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

drop policy if exists "invoice_items_modify" on invoice_items;
create policy "invoice_items_modify"
  on invoice_items for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

drop policy if exists "quotes_select_financial" on quotes;
create policy "quotes_select_financial"
  on quotes for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

drop policy if exists "quotes_modify_financial" on quotes;
create policy "quotes_modify_financial"
  on quotes for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

drop policy if exists "quote_items_select" on quote_items;
create policy "quote_items_select"
  on quote_items for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

drop policy if exists "quote_items_modify" on quote_items;
create policy "quote_items_modify"
  on quote_items for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));

drop policy if exists "payments_select_financial" on payments;
create policy "payments_select_financial"
  on payments for select
  to authenticated
  using (auth_user_role() in ('admin', 'project_manager', 'commercial', 'finance'));

drop policy if exists "payments_modify_admin_commercial" on payments;
create policy "payments_modify_admin_commercial"
  on payments for all
  to authenticated
  using (auth_user_role() in ('admin', 'commercial', 'finance'))
  with check (auth_user_role() in ('admin', 'commercial', 'finance'));
