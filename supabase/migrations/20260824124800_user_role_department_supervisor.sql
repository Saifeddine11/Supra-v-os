-- Permission role: supervises employees.department / tasks.department.
-- Must be committed before policies reference the new value (PG enum ADD VALUE).

alter type public.user_role add value if not exists 'department_supervisor';
