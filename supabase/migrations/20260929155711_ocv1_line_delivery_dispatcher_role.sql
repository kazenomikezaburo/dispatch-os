-- OCV1-07C2-04: least-privilege login role for the server-only LINE dispatcher.

do $body$
begin
  if not exists (select 1 from pg_roles where rolname = 'opscue_line_dispatcher') then
    create role opscue_line_dispatcher
      login
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls;
  end if;
end;
$body$;

revoke all on schema public from opscue_line_dispatcher;
revoke all on all tables in schema public from opscue_line_dispatcher;
revoke all on all sequences in schema public from opscue_line_dispatcher;
revoke all on all functions in schema public from opscue_line_dispatcher;
revoke all on all tables in schema private from opscue_line_dispatcher;
revoke all on all sequences in schema private from opscue_line_dispatcher;
revoke all on all functions in schema private from opscue_line_dispatcher;

grant usage on schema private to opscue_line_dispatcher;
grant execute on function private.claim_line_deliveries(integer) to opscue_line_dispatcher;
grant execute on function private.finalize_line_delivery(uuid,uuid,text,integer,integer,boolean,text,text)
  to opscue_line_dispatcher;

comment on role opscue_line_dispatcher is
  'Server-only OCV1 LINE dispatcher. Password/connection secret is provisioned outside migrations; only claim/finalize EXECUTE is granted.';
