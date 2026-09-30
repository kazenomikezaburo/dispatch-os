# OCV1-07C2-06A — Production Readiness & Canary Preparation

Status: `LOCAL SAFETY BLOCKERS COMPLETE / PHASE B NOT STARTED`

This document is an operator runbook and design freeze. Phase A created no AWS resource, changed no remote Supabase object, registered no secret, sent no LINE message, and enabled no Scheduler.

## 1. Entry gates and execution order

Phase B must be executed in this order. A failed gate stops the run; later steps must not be skipped ahead.

1. Complete the isolated dependency-security update described in section 2 and retain its regression evidence.
2. Resolve the AWS account, operator identity, Tokyo Region, CDK bootstrap, deployment permissions, billing alerts, alarm recipient, and production OpsCue origin in section 3.
3. Implement and locally verify the canary-only database boundary in section 5. The current broad claim RPC must not be used for a real canary.
4. Apply the existing C1/C2 migrations and the new canary-boundary migration to the intended Supabase project through an explicitly approved remote change window.
5. Provision two independently rotatable database credentials: normal dispatcher and canary dispatcher. Verify the canary credential cannot invoke the broad claim RPC.
6. Prove the Session pooler, TLS, effective role, RPC grants, and direct-DML denials using section 4. Do not invoke a claim while performing the privilege check.
7. Update and review the CDK gaps in section 6: immutable ECR tags, digest-pinned task image, production origin input, alarm actions, and canary task definition.
8. Deploy with the Scheduler `DISABLED` and both normal/canary delivery flags off. Populate secrets only after the resource policies and task execution role are reviewed.
9. Run one disabled manual Fargate task. Expected evidence is `claimed=0`, `providerCalls=0`; no delivery row changes.
10. Create one fresh Reminder Notification for the dedicated canary Worker, create one short-lived canary scope for that exact Notification/delivery, and prove the canary scope query resolves exactly one row.
11. Run two concurrent canary tasks against the mock provider or a no-send adapter. Expected: one task claims the allowlisted delivery and the other claims zero.
12. Only after a two-person check of destination, consent, scope, task revision, image digest, logs, and emergency stop controls may Phase B perform one manual real-provider task with Scheduler still disabled.
13. Reconcile DB attempt evidence, CloudWatch evidence, Worker receipt, and non-mutation checks. Revoke/expire the canary scope and return the canary task flag to false.

## 2. Dependency security gate

The isolated local update is complete: `next@16.3.7` is exact and the lockfile resolves `sharp@0.35.5` (no older sharp instance). `npm audit --omit=dev` reports zero vulnerabilities.

- GitHub marks Next.js `>=16.0.0 <16.3.3` affected by the Windows-hosted filesystem RCE and the AVIF Image Optimization RCE. The first patched 16.x release is `16.3.3`.
- `sharp <0.35.4` is affected by the libheif issue. The patched release is `0.35.4`.
- `next@16.3.3` declares optional `sharp ^0.35.3`; therefore it does not by itself freeze the safe lower bound in every lockfile resolution.
- `next@16.3.7` declares optional `sharp ^0.35.4`. The recommended isolated update is therefore exact `next@16.3.7`, followed by proof that the lock resolves `sharp >=0.35.4`.

References: [Next.js Windows RCE advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36), [Next.js AVIF advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), [sharp advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c).

The dependency update remains a separately reviewable `package.json` / `package-lock.json` pair and was not mixed with any AWS or remote operation:

```powershell
npm install --save-exact next@16.3.7
npm ls next sharp --all
npm audit --omit=dev
```

Observed locally: version/lock inspection, audit, focused ESLint, TypeScript, production build, C1 identity/boundary, C2-02 through C2-05, Notification and Reminder regressions passed. The login page smoke at 1440x900, 1280x900 and 390x844 had zero horizontal overflow, a 44px primary button, keyboard focus progression, and zero console/React/hydration errors. The installed sharp native pipeline produced an 8x8 WebP with `sharp@0.35.5`; the app currently has no `next/image` consumer, so there was no application image route to exercise. Rollback is the reviewed pre-update `package.json` and lockfile pair; never hand-edit only the lockfile.

## 3. AWS readiness checklist

### Account and deployment authority

- [ ] Record the 12-digit production account ID and approved CLI profile without placing either in source.
- [ ] Require MFA/SSO and a short-lived deployment role; do not deploy using a root or long-lived access key.
- [ ] Pin the deployment Region to `ap-northeast-1` and confirm every command includes or inherits that Region.
- [ ] Confirm organization SCPs allow the exact CloudFormation, ECS, ECR, EC2/VPC, Scheduler, IAM, Secrets Manager, Logs, CloudWatch, SNS, Budgets, and SSM operations.
- [ ] Confirm the CDK bootstrap stack and bootstrap version before deployment. Bootstrapping itself is a privileged resource-changing operation and belongs to the approved Phase B window. AWS documents that bootstrap permissions include broad CloudFormation/ECR/SSM/S3/IAM access, so the bootstrap operator must be separate from the runtime roles: [CDK bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html).

Read-only preparation commands:

```powershell
aws sts get-caller-identity --profile <approved-profile>
aws configure get region --profile <approved-profile>
aws cloudformation describe-stacks --stack-name CDKToolkit --region ap-northeast-1 --profile <approved-profile>
aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --region ap-northeast-1 --profile <approved-profile>
npm run cdk:synth -- --output <temporary-directory>
npx cdk diff OpsCueLineDelivery --profile <approved-profile> --region ap-northeast-1
```

Expected: the identity/account matches the written approval; Region is Tokyo; bootstrap exists at a version supported by the installed CDK; diff contains only reviewed OpsCue resources; Scheduler remains `DISABLED`; `LINE_DELIVERY_ENABLED` remains `false`; no secret value appears. A mismatch stops the run—do not bootstrap or deploy into a different account to make the check pass.

### IAM, billing and alert destination

- [ ] Scheduler role: exact task definition/cluster `ecs:RunTask` and exact ECS roles `iam:PassRole` only.
- [ ] Task execution role: exact repository pull, exact two secret ARNs, exact log group writes.
- [ ] Task role: no AWS API privileges.
- [ ] Deployment role and bootstrap roles are not reused as runtime roles.
- [ ] Select an SNS/email or incident destination and confirm subscription before canary.
- [ ] Configure AWS Budget actual and forecast alerts. Budget alerts can lag actual usage and are not an emergency stop; AWS documents this delay: [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).
- [ ] Route provider-auth, consecutive dispatcher failure, Scheduler target error, and dropped-invocation alarms to the confirmed destination.
- [ ] Confirm the production origin is a single HTTPS origin with no path/query/hash, and verify `/worker/notifications/<UUID>` uses normal authentication and recipient authorization.

## 4. Supabase Session pooler and privilege verification

Use the Dashboard Connect panel; do not derive the pooler hostname from the Region. The shared Session pooler uses port 5432 and a custom-role username of `[ROLE].[PROJECT_REF]`: [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres). Download the project CA certificate and use `verify-full`; Supabase documents that this verifies encryption, CA and hostname: [SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement), [psql TLS connection](https://supabase.com/docs/guides/database/psql).

Do not place a password or URL containing a password in command history. Set non-secret connection fields in the process and let `psql -W` prompt for the password:

```powershell
$env:PGHOST = '<copied-session-pooler-host>'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = 'opscue_line_dispatcher.<project-ref>'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = '<absolute-path-to-downloaded-project-ca>'
psql -X -W -v ON_ERROR_STOP=1 -c '\conninfo'
psql -X -W -v ON_ERROR_STOP=1 -c "begin; set local role opscue_line_dispatcher; select current_user, session_user; rollback;"
```

Expected: connection uses SSL to the copied hostname; `current_user` after `SET LOCAL ROLE` is `opscue_line_dispatcher`; the pooler tenant suffix appears only in authentication identity/session context, not as a different database authorization role.

Privilege proof is read-only and does not call either RPC:

```sql
select
  has_function_privilege(current_user, 'private.claim_line_deliveries(integer)', 'EXECUTE') as can_claim,
  has_function_privilege(current_user, 'private.finalize_line_delivery(uuid,uuid,text,integer,integer,boolean,text,text)', 'EXECUTE') as can_finalize,
  has_table_privilege(current_user, 'private.line_notification_deliveries', 'SELECT,INSERT,UPDATE,DELETE') as delivery_dml,
  has_table_privilege(current_user, 'private.line_delivery_attempt_starts', 'SELECT,INSERT,UPDATE,DELETE') as start_dml,
  has_table_privilege(current_user, 'private.line_delivery_attempt_results', 'SELECT,INSERT,UPDATE,DELETE') as result_dml;
```

Expected for the normal dispatcher: `can_claim=true`, `can_finalize=true`, and every DML aggregate is false. A direct `select * from private.line_notification_deliveries limit 1` must fail with permission denied. Do not execute `claim_line_deliveries` during this check because claim has canonical state and attempt-history side effects.

For the canary credential, the expected result differs: broad `claim_line_deliveries(integer)` must be false; only the canary-specific claim and exact finalize command are executable. Any unexpected privilege is a hard stop. Clear the `PG*` process variables after the session.

Password rotation uses a second custom role/credential, validates it through the Session pooler, switches the ECS secret/task revision, then revokes the old LOGIN credential. Supabase notes that shared-pooler credential changes can be briefly cached; alternating credentials avoids an outage: [pooler password rotation behavior](https://supabase.com/docs/guides/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation).

## 5. Canary isolation design

### Why the current command is unsafe for a canary

`private.claim_line_deliveries(p_limit)` selects all due pending/retryable rows ordered by time. `LINE_DELIVERY_BATCH_SIZE=1` limits count, not recipient. An older delivery for another Worker can be claimed and sent. Checking the claimed Worker in Node after claim is also unsafe: claim already increments attempt count, creates a lease and attempt-start row, and exposes the destination to the process.

The canary must not disable other Workers, alter their consent, terminalize their deliveries, reorder timestamps, or temporarily change the production claim function's meaning.

### Implemented local prerequisite

The separate private canary boundary is now implemented locally before any real send:

1. Add `private.line_delivery_canary_scopes` with an opaque scope UUID, exact `delivery_id`, exact expected `recipient_profile_id`, `expires_at` (maximum 15 minutes), `created_at`, single-use `claimed_at`, and `revoked_at`. No LINE ID, token, Notification body, or provider response is stored.
2. Require one active scope per delivery and reject creation unless the delivery belongs to the expected Worker, is pending, has zero attempts, and the Notification is one of the four Reminder types.
   Scope creation is a private owner/operator command with all runtime grants revoked; it accepts the exact canary Notification plus expected test profile and resolves the delivery server-side. It is not a browser/Admin API and is unavailable to either dispatcher role.
3. Add `private.claim_line_delivery_canary(p_scope_id uuid)` returning at most one row. Under the same transaction and row lock it must:
   - lock and validate the unexpired, unrevoked, unused scope;
   - join the exact delivery, Notification and expected recipient;
   - reuse the canonical active Worker, link, availability, consent, enablement watermark, attempt limit, 23-hour and lease checks;
   - atomically create the normal attempt-start and mark the scope used;
   - return nothing and make no delivery/attempt mutation when scope validation fails.
4. Extract shared claim validation/transition logic into a private internal function only if this avoids semantic drift. The normal claim result and ordering must remain unchanged and all existing C2-03 tests must pass.
5. Create `opscue_line_canary_dispatcher` as LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS. Grant only private schema usage, canary-claim EXECUTE, and exact finalize EXECUTE. Explicitly revoke broad claim and all table/sequence/function privileges first.
6. Add a server-only `LINE_CANARY_SCOPE_ID` mode that cannot coexist with normal dispatcher mode. The canary image/task must fail closed unless delivery is enabled, batch size is exactly 1, and a valid scope UUID is present. It calls only the canary RPC.
7. Use a separate Secrets Manager DB URL and separate canary task definition/revision. The normal dispatcher credential must never be injected into the canary task.
8. Scheduler remains connected only to the normal disabled task. Canary is manual `RunTask` only.

Required tests: another Worker has an older pending row; scope points to the test Worker; only the scoped row is returned; wrong Worker/delivery pair, expired/revoked/replayed scope, random UUID, another branch, terminal delivery and existing attempt all return zero without mutation; two concurrent canary tasks yield one claim; canary role cannot call broad claim or table DML; normal C2-03 behavior is unchanged.

Implementation is in `20260930110059_ocv1_line_delivery_canary_isolation.sql`. Local verification proved exact-recipient isolation despite an older other-Worker pending delivery, wrong-recipient rejection, expired/revoked/replayed/random scopes, terminal/existing-attempt refusal, and one claim across two concurrent tasks. The normal C2-03 suite remains 38/38 PASS.

The one-shot runtime now has mutually exclusive `normal` and `canary` modes. Canary requires `LINE_CANARY_SCOPE_ID`, its dedicated `OPSCUE_LINE_CANARY_DISPATCHER_DATABASE_URL`, and batch size exactly 1. The CDK defines a separate disabled manual canary task and execution role; the Scheduler target remains the normal task only. Both task definitions default `LINE_DELIVERY_ENABLED=false`.

## 6. ECR, image, secrets and emergency stop

### Image integrity gaps to close

The current CDK repository enables scanning but does not set `imageTagMutability`; the task references `c2-05-placeholder` by tag. Before deployment:

- set the ECR repository to immutable tags; AWS documents that immutable repositories reject tag overwrite: [ECR tag immutability](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html);
- build with a unique release tag, push once, wait for scan completion, reject critical/high findings unless explicitly accepted;
- obtain the registry digest and pin the ECS task image to `repository@sha256:<digest>`, not `latest` or a movable tag;
- record source revision, Dockerfile hash, lockfile hash, image digest, scan result and task-definition revision in the canary evidence.

Read-only verification after an authorized push:

```powershell
aws ecr describe-images --repository-name opscue-line-dispatcher --image-ids imageTag=<unique-tag> --region ap-northeast-1 --profile <approved-profile>
aws ecr describe-image-scan-findings --repository-name opscue-line-dispatcher --image-id imageDigest=<digest> --region ap-northeast-1 --profile <approved-profile>
aws ecs describe-task-definition --task-definition <canary-task-family:revision> --region ap-northeast-1 --profile <approved-profile>
```

Expected: one immutable digest, completed scan, task definition referencing that digest, Scheduler disabled, canary flag false by default.

### Secret handling and rotation

Create secret resources without values through reviewed CDK, then enter values through an approved operator interface. Do not pass values on a shell command line, store them in repository files, paste them into tickets, or put them in CloudFormation parameters. Secrets Manager recommends least privilege, rotation and monitoring: [Secrets Manager best practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html).

Required secrets are normal dispatcher DB URL, canary dispatcher DB URL, and Messaging API channel access token. ECS execution role receives only the exact secrets needed by its task definition. The application task role receives no Secrets Manager API permission. Rotation creates a new secret version/new DB credential, registers a new task revision, runs a disabled smoke task, then retires the old credential/token only after verification. LINE token rotation must overlap only as supported by the provider and must never silently switch to a LINE Login token.

### Emergency stop sequence

1. Keep/return the Scheduler to `DISABLED`.
2. Register a task revision with `LINE_DELIVERY_ENABLED=false`; for canary also remove the scope ID.
3. Stop any running dispatcher task:

```powershell
aws ecs list-tasks --cluster <cluster> --family <task-family> --desired-status RUNNING --region ap-northeast-1 --profile <approved-profile>
aws ecs stop-task --cluster <cluster> --task <task-arn> --reason 'OpsCue LINE emergency stop' --region ap-northeast-1 --profile <approved-profile>
```

4. Revoke the active canary scope. If credential exposure is suspected, revoke LOGIN/change the DB credential and rotate the Messaging token, then publish a new task revision.
5. Do not manually delete or rewrite a delivery/attempt row. A killed request keeps its immutable attempt-start; after the 60-second lease the canonical recovery records unknown result and reuses the stable retry key.
6. If a Worker-specific stop is needed, use the existing unlink/unfollow/Reminder-OFF contract; it terminalizes unsent delivery without changing Notification read, Journey, Attendance or Attention.

Rollback of an AWS stack revision means selecting the last reviewed digest/task definition while keeping delivery disabled. Rollback must never enable the schedule or restore a revoked secret automatically.

## 7. Timing, overlap and cost measurement plan

For each manual task record only AWS task identifiers/timestamps and aggregate safe logs—never destination, token, title, summary or Notification ID.

- Cold start: compare ECS `createdAt`, `pullStartedAt`, `pullStoppedAt`, `startedAt`, and `stoppedAt`; record image-pull, startup, dispatcher and total durations separately.
- Watchdog: confirm the 55-second timer starts in the Node process, not at `RunTask`; measure whether cold-start plus runtime can cross the one-minute cadence.
- Provider bound: inject a mock delay below and above the 8-second provider timeout; verify bounded finalize/retry and process exit before 55 seconds.
- Duplicate tasks: start two manual canary tasks simultaneously against one scope. Exactly one provider call is allowed; the second must claim zero. Repeat with a simulated crash and wait beyond the 60-second lease to prove stable retry-key recovery.
- One-minute schedule model: use measured p50/p95/p99 task duration and cold-start duration to estimate overlap probability before enabling Scheduler. Scheduler remains disabled during Phase B.
- Cost: record Fargate vCPU/memory seconds, public IPv4 task duration, ECR storage/scan, Secrets reads, log ingestion/storage, custom metrics, alarms, and Container Insights observations. Set a log-size budget and reconsider Container Insights if its measured cost exceeds the pilot value.

Commands after authorized manual task launch:

```powershell
aws ecs describe-tasks --cluster <cluster> --tasks <task-arn-1> <task-arn-2> --region ap-northeast-1 --profile <approved-profile>
aws logs filter-log-events --log-group-name /opscue/line-dispatcher --start-time <epoch-ms> --region ap-northeast-1 --profile <approved-profile>
aws cloudwatch get-metric-data --metric-data-queries file://<reviewed-query-file> --start-time <utc> --end-time <utc> --region ap-northeast-1 --profile <approved-profile>
```

Expected: no secret/provider payload in output; one scoped claim; bounded duration; no unexplained running task. Any 401/403, watchdog exit, broad claim, secret disclosure, duplicate provider call or missing finalize evidence stops the canary.

## 8. C1 real-provider evidence still required

The current C1 result document still says `PROVIDER VERIFICATION BLOCKED`, although later operator evidence confirmed real Login redirect, code exchange, ID-token verification, friendship API, link completion, initial consent OFF, and webhook console verification. The document must not be marked COMPLETE merely from that summary.

The C1 result's older expected webhook table also says successful signed events return 204. The implemented/final provider contract now returns HTTP 200 for both signed empty verification payloads and normally handled events; the result document must be corrected to match verified behavior without changing signature-before-parse or mutation semantics.

Before or during Phase B, add dated, redacted evidence for:

- a real signed `follow` event changing availability only and not enabling consent;
- a real signed `unfollow` event making the destination unavailable, disabling consent, and terminalizing unsent delivery without other domain mutation;
- replay/redelivery convergence when the provider can redeliver;
- real unlink and re-link, proving re-link remains consent OFF and cannot move identity across Workers;
- real Reminder ON/OFF persistence and authorization;
- deep-link own Notification, unauthenticated login continuation, and foreign/missing safe-unavailable behavior;
- confirmation that raw LINE user ID, provider token and credentials are absent from evidence, UI, logs and DB payload columns.

Update `docs/ocv1-07c1-line-identity-consent-result.md` only after the evidence exists. Preserve the original blocked history and append a provider-verification section with observed/untested items; set `OCV1-07C1: COMPLETE` only when every required real-provider item passes.

## 9. Security blockers and required user actions

### Hard blockers

1. ECR tags are not configured immutable and ECS is not digest-pinned.
2. Production origin remains a deliberate invalid placeholder.
3. Alarm actions, billing budget and confirmed recipient are not defined.
4. Production account/profile/bootstrap and organization policy are unconfirmed.
5. Session-pooler custom-role login, project CA trust with `verify-full`, and effective privileges are unproven in production.
6. Secrets are intentionally empty and rotation owners are unidentified.
7. C1 real follow/unfollow, unlink/re-link and deep-link evidence remains incomplete in the canonical result document.

### User decisions/actions

- Name the AWS account/profile, deployment role owner, Tokyo Region approval and CDK bootstrap operator.
- Choose the alarm/budget notification destination and acknowledge its subscription.
- Provide the production HTTPS origin and confirm DNS/TLS ownership.
- In the Supabase Dashboard, copy the exact Session pooler host, download the CA, identify the production Project Ref, and approve creation/rotation of separate normal and canary role credentials.
- Name the dedicated canary Worker/LINE account and a two-person checker; do not provide the raw LINE user ID in chat or documentation.
- Assign owners for DB credential rotation, LINE token rotation, emergency stop and post-canary evidence review.

## 10. Phase B go/no-go and recovery criteria

Phase B is GO only when all hard blockers are closed, C1 required identity controls are evidenced, all local C1/C2/security/build tests pass, CDK diff is reviewed, image digest and scan are accepted, secrets are populated without disclosure, normal and canary DB privileges are independently proven, the exact scope resolves one fresh zero-attempt delivery for the approved Worker, Scheduler is disabled, and two operators sign off immediately before `RunTask`.

Immediate STOP conditions are wrong account/Region/origin, broad claim privilege in the canary role, more or fewer than one scoped row, another Worker returned, consent/link/Worker state mismatch, mutable or unscanned image, missing TLS verification, secret in output, provider 401/403, duplicate send, task exceeding the runtime bound, CloudWatch evidence unavailable, or any Notification/Journey/Attendance/Attention side effect outside the frozen contract.

Recovery is: disable task revision, stop tasks, revoke scope, wait for the 60-second lease rather than rewriting evidence, inspect controlled attempt state, rotate suspected credentials, verify in-app Notification remains canonical, and rerun the disabled smoke test. Scheduler activation is a later explicitly approved phase and is never part of Phase B recovery.

## 11. Local implementation evidence and explicit non-actions

- Dependency gate: exact Next 16.3.7, sharp 0.35.5 only, production audit 0, production build PASS.
- Migration: `20260930110059_ocv1_line_delivery_canary_isolation.sql`, applied to local Supabase only.
- Canary DB isolation: 18/18 PASS; dedicated fixtures remainder 0.
- Normal claim regression: C2-03 38/38 PASS.
- Push/runtime boundary: 28/28 PASS; normal/canary mock container PASS.
- CDK assertions and synth: PASS; synth shows the disabled Scheduler targets only the normal task definition.
- C1/C2-02/Notification/Reminder regressions listed above: PASS.

No AWS API mutation, CDK deploy/bootstrap, remote Supabase query/change, secret registration, ECR push, ECS task, real LINE request, Scheduler enablement, commit or push occurred. Existing dirty changes and `.tmp-notif-2c-local.*` logs remain intact. Phase B has not started.
