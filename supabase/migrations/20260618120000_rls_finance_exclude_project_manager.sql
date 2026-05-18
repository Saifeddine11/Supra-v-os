-- Chef de projet : pilotage production / planning — pas lecture factures ni devis (montants).
-- Aligné sur canViewInvoices / canModifyQuotes (capabilities.ts).

drop policy if exists "invoices_select_scoped" on public.invoices;
create policy "invoices_select_scoped"
  on public.invoices for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_is_finance()
    or (
      public.auth_is_commercial()
      and exists (
        select 1 from public.clients c
        where c.id = public.invoices.client_id and c.account_manager_id = public.auth_employee_id()
      )
    )
  );

drop policy if exists "invoice_items_select_scoped" on public.invoice_items;
create policy "invoice_items_select_scoped"
  on public.invoice_items for select
  to authenticated
  using (
    exists (
      select 1 from public.invoices inv
      where inv.id = invoice_items.invoice_id
        and (
          public.auth_is_admin()
          or public.auth_is_finance()
          or (
            public.auth_is_commercial()
            and exists (
              select 1 from public.clients c
              where c.id = inv.client_id and c.account_manager_id = public.auth_employee_id()
            )
          )
        )
    )
  );

drop policy if exists "quotes_select_scoped" on public.quotes;
create policy "quotes_select_scoped"
  on public.quotes for select
  to authenticated
  using (
    public.auth_is_admin()
    or public.auth_is_finance()
    or (
      public.auth_is_commercial()
      and exists (
        select 1 from public.clients c
        where c.id = public.quotes.client_id and c.account_manager_id = public.auth_employee_id()
      )
    )
  );

drop policy if exists "quote_items_select_scoped" on public.quote_items;
create policy "quote_items_select_scoped"
  on public.quote_items for select
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_items.quote_id
        and (
          public.auth_is_admin()
          or public.auth_is_finance()
          or (
            public.auth_is_commercial()
            and exists (
              select 1 from public.clients c
              where c.id = q.client_id and c.account_manager_id = public.auth_employee_id()
            )
          )
        )
    )
  );
