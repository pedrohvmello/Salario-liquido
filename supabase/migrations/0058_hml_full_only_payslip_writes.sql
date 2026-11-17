-- HML only. Storage and database write permissions require effective Full plan.
-- Existing user-owned payslips remain readable/exportable after downgrade.
-- Restrictive policies compose with legacy permissive owner policies (which
-- otherwise would grant writes through OR semantics).
create policy full_only_payslips_insert
on storage.objects as restrictive for insert to authenticated
with check(
 bucket_id<>'payslips'
 or (
   (storage.foldername(name))[1]=(select auth.uid())::text
   and (select private.current_mfa_satisfied())
   and private.pep_plan_for_user((select auth.uid()))='full'
 )
);
create policy full_only_payslips_update
on storage.objects as restrictive for update to authenticated
using(bucket_id<>'payslips' or (
 (storage.foldername(name))[1]=(select auth.uid())::text
 and private.pep_plan_for_user((select auth.uid()))='full'))
with check(bucket_id<>'payslips' or (
 (storage.foldername(name))[1]=(select auth.uid())::text
 and private.pep_plan_for_user((select auth.uid()))='full'));

create policy full_only_statements_insert
on public.statements as restrictive for insert to authenticated
with check(user_id=(select auth.uid())
 and (select private.current_mfa_satisfied())
 and private.pep_plan_for_user((select auth.uid()))='full');

create policy full_only_statements_update
on public.statements as restrictive for update to authenticated
using(user_id=(select auth.uid()) and private.pep_plan_for_user((select auth.uid()))='full')
with check(user_id=(select auth.uid())
 and (select private.current_mfa_satisfied())
 and private.pep_plan_for_user((select auth.uid()))='full');

create policy full_only_statement_lines_insert
on public.statement_lines as restrictive for insert to authenticated
with check(user_id=(select auth.uid())
 and (select private.current_mfa_satisfied())
 and private.pep_plan_for_user((select auth.uid()))='full');

create policy full_only_statement_lines_update
on public.statement_lines as restrictive for update to authenticated
using(user_id=(select auth.uid()) and private.pep_plan_for_user((select auth.uid()))='full')
with check(user_id=(select auth.uid())
 and (select private.current_mfa_satisfied())
 and private.pep_plan_for_user((select auth.uid()))='full');
