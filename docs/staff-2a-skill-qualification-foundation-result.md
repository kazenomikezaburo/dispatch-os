# STAFF-2A — Skill & Qualification Foundation Result

## Status

`STAFF-2A: COMPLETE`

## Executive Summary

Staffing判断に使うSkill / Qualificationを、Worker、Job、Shift、Assignment、Placementとは独立したcanonical factとして定義した。

現行schemaで再利用できる正本は以下である。

- Staff identity / lifecycle: `public.workers`
- Job / Shift context: `public.jobs` / `public.shift_slots`
- actual staffing relation: `public.assignments`
- Placement relation: Assignmentを参照する`public.assignment_placement_segments`
- human-readable work requirement note: `public.jobs.requirements`

Local PostgreSQLと全migrationを照合した結果、Skill、Qualification、Staff保有、資格期限、構造化requirementを表すtable / columnは存在しない。`jobs.requirements`は自由記述であり、表示用説明としては保持するが、Candidate eligibility、duplicate prevention、expiry判定の正本には使用しない。

したがって、構造化Skill / Qualificationを実装する次Phaseではschema追加が必要である。本Phaseではmigration、UI、Assignment / Placement behaviorを変更しない。

## Existing Architecture Audit

### Worker / Staff

`public.workers`がstaffing entityの正本である。

```text
id
staff_code (unique)
branch_id
auth_profile_id (nullable unique)
display_name
status = active | inactive | suspended
```

`profiles`はAuth identity / roleであり、SkillやQualificationをAuth profileへ紐付けない。Auth未連携StaffもSkill / Qualificationを保有できるため、全保有関係は`worker_id`を参照する。

### Assignment

`public.assignments`がWorkerとShiftの実配置を表す。既存partial unique index `assignments_active_shift_worker_unique`が、同一Workerの同一Shiftへのactive Assignment重複を防止している。

Skill / QualificationはAssignmentそのものではなく、将来のAssignment作成前に評価するcandidate factsである。本contractは既存Assignmentを削除、取消、再分類しない。

### Placement

Placement segmentは既存Assignmentを参照する。Skill / QualificationはPlacement segmentへコピーしない。将来Placement UIがcandidate理由を表示する場合も、Worker + Shift requirementから都度導出し、segmentを第二のSkill正本にしない。

### Job requirements

`public.jobs.requirements text`だけが既存する。これは募集・勤務説明用の自由記述を維持する。

禁止する利用:

- keyword parsingによるSkill判定
- Qualification codeや期限の埋め込み
- JSON形式を暗黙contractとして保存
- Candidate eligible / ineligibleの正本化

構造化requirementを追加しても、既存`jobs.requirements`はhuman noteとして併存する。

## Responsibility Boundary

### Skill

Skillは、業務を行う能力・経験・訓練の事実であり、外部発行資格や法的有効期限を必須としない。

例:

- レジ操作
- フォークリフト経験ではなく、単なる倉庫内作業経験
- イベント受付
- 特定機器の社内研修修了

初期contractはpresenceのみを扱う。

```text
has skill / does not have skill
```

proficiency、年数、点数、rank、推薦度は追加しない。将来必要になった場合も別contractで定義し、自由な数値scoreをCandidate rankingへ流用しない。

### Qualification

Qualificationは、発行・有効期間・失効を判定できるcredential factである。

例:

- 外部資格
- 免許
- 有効期限を持つ講習修了証
- 期限のない認定

QualificationはSkillの属性ではない。同一概念をSkillとQualificationへ二重登録しない。法的・契約的にcredentialの有効性を確認する必要があるものはQualificationとして管理する。

## Proposed Canonical Model

以下は次schema Phaseで実装すべきnarrow modelであり、本Phaseでは作成していない。

### Skill master

概念table: `public.skills`

```text
id uuid PK
code text NOT NULL UNIQUE
name text NOT NULL
description text NULL
is_active boolean NOT NULL DEFAULT true
created_at / updated_at
```

- `code`はstable identityで、trim後blank禁止。display nameとは別にする。
- codeは参照開始後immutableを第一候補とする。
- name / descriptionは表示metadataであり、eligibility identityに使わない。
- hard deleteは参照がない場合に限定し、通常はdeactivateする。

### Qualification master

概念table: `public.qualifications`

```text
id uuid PK
code text NOT NULL UNIQUE
name text NOT NULL
description text NULL
expiry_policy = none | optional | required
is_active boolean NOT NULL DEFAULT true
created_at / updated_at
```

`expiry_policy`はStaff credentialの入力整合性を表す。

- `none`: `expires_on`は禁止
- `required`: `expires_on`必須
- `optional`: 発行条件により期限あり / なしの両方を許す

候補判定はmasterの想定期間ではなく、Staff保有rowの実際の`valid_from` / `expires_on`を使う。

### Staff skill holding

概念table: `public.worker_skills`

```text
worker_id uuid FK workers
skill_id uuid FK skills
acquired_on date NULL
is_active boolean NOT NULL DEFAULT true
created_at / updated_at
PRIMARY KEY (worker_id, skill_id)
```

- 1 Staff / 1 Skillにつきcurrent factは1行。
- 同じSkillの重複付与をDB primary keyで防ぐ。
- inactive holdingは履歴として残るがCandidate matchには数えない。
- Skillにexpiry semanticsを持たせない。

### Staff qualification holding

概念table: `public.worker_qualifications`

```text
worker_id uuid FK workers
qualification_id uuid FK qualifications
credential_number text NULL
issued_on date NULL
valid_from date NULL
expires_on date NULL
revoked_at timestamptz NULL
created_at / updated_at
PRIMARY KEY (worker_id, qualification_id)
CHECK (expires_on IS NULL OR valid_from IS NULL OR expires_on >= valid_from)
```

- 1 Staff / 1 Qualificationにつきcurrent credentialは1行。
- renewalはcurrent rowのcredential factsを更新する。更新履歴が必要になった場合は、同一tableに重複current rowsを許すのではなく、別のappend-only audit contractを設計する。
- `credential_number`はeligibilityやUI route identityに使わない。
- `revoked_at`があるcredentialは期限に関係なく無効。
- Staffは異なるQualificationを複数保有できる。

## Master Lifecycle

```text
create active
→ metadata correction
→ deactivate
→ optional reactivate
```

- deactivateはStaff保有rowや過去Assignmentを削除しない。
- inactive masterへ新しいStaff holding / Job requirementを追加しない。
- inactive masterの既存requirementはfail closedとし、Workerを「不足」と誤認させず`requirement_master_inactive`としてconfiguration issueを返す。
- inactive masterの既存holdingはhistorical factとして読めるが、新しいCandidate matchには数えない。
- master reactivate時もStaff credentialのexpiry / revoked状態を再評価する。

## Qualification Validity

QualificationはCandidate対象Shiftの`starts_at`をcanonical evaluation timeとする。現在時刻で判定すると、将来Shift開始前に資格が失効するケースを誤判定するため禁止する。

date判定は既存運用calendarと同じAsia/TokyoのShift開始日を使用する。

```text
valid =
  Worker.status = active
  AND Qualification master is active
  AND revoked_at IS NULL
  AND (valid_from IS NULL OR valid_from <= evaluation_date)
  AND (expires_on IS NULL OR expires_on >= evaluation_date)
```

`expires_on`当日は有効で、翌日から`expired`とする。

Closed validity states:

```text
valid
not_yet_valid
expired
revoked
master_inactive
missing
```

### Required scenarios

| Scenario | Representation | Candidate fact |
| --- | --- | --- |
| Skill only | active `worker_skills` row | `has_skill` |
| Qualification without expiry | `expires_on = null`, policy `none` or `optional` | `has_valid_qualification` |
| Qualification with expiry | valid range includes Shift start date | `has_valid_qualification` |
| Expired qualification | `expires_on < Shift start date` | `qualification_expired` |
| Inactive master | holding remains; master `is_active = false` | `requirement_master_inactive` or non-counting historical holding |
| Multiple qualifications | one row per distinct Qualification master | each evaluated independently |

## Structured Requirements Connection

Structured requirementはSkill / Qualification masterとJob / Shiftを結ぶ別factである。`jobs.requirements`を置換しない。

Initial Job baseline candidates:

```text
job_skill_requirements(job_id, skill_id)
PRIMARY KEY (job_id, skill_id)

job_qualification_requirements(job_id, qualification_id)
PRIMARY KEY (job_id, qualification_id)
```

初期requirementはすべてmandatory presenceとする。preferred、weight、score、minimum proficiencyは追加しない。

将来Shift固有requirementが必要な場合は、generic polymorphic tableやJSONにせず、次のnarrow tablesを追加できる。

```text
shift_skill_requirements(shift_slot_id, skill_id)
shift_qualification_requirements(shift_slot_id, qualification_id)
```

Job baselineとShift-specific requirementはadditive unionとする。override / removal semanticsが必要になるまでは、Shift側からJob requirementを暗黙削除しない。

inactive masterを新規requirementに指定することはcommandで拒否する。既存requirementのmasterが後からinactiveになった場合はconfiguration issueとしてfail closedする。

## Candidate Eligibility Read Shape

Skill / Qualification foundationが提供するのは説明可能なrequirement factsであり、opaqueな総合scoreではない。

```ts
type RequirementResult =
  | {
      kind: "skill";
      requirementId: string;
      code: string;
      label: string;
      state: "satisfied" | "missing" | "requirement_master_inactive";
    }
  | {
      kind: "qualification";
      requirementId: string;
      code: string;
      label: string;
      state:
        | "satisfied"
        | "missing"
        | "not_yet_valid"
        | "expired"
        | "revoked"
        | "requirement_master_inactive";
      validFrom: string | null;
      expiresOn: string | null;
    };

type CandidateRequirementFacts = {
  workerId: string;
  shiftId: string;
  evaluatedAt: string; // canonical Shift start
  workerStatus: "active" | "inactive" | "suspended";
  requirementsEligible: boolean;
  requirements: RequirementResult[];
  reasonCodes: Array<
    | "worker_inactive"
    | "skill_missing"
    | "qualification_missing"
    | "qualification_not_yet_valid"
    | "qualification_expired"
    | "qualification_revoked"
    | "requirement_master_inactive"
  >;
};
```

- `requirementsEligible`はSkill / Qualification requirementだけの結果であり、「配置可能」の総合判定とは呼ばない。
- label / explanatory sentenceはserver-controlled presentationから生成し、DBに自由文reasonを保存しない。
- Candidate Pickerはmatched / missing / expiredを同じreadで説明できる。
- responseはactorが閲覧できるBranch / Shift / Workerに限定する。
- credential numberなど不要な個人情報はcandidate listへ含めない。

## Candidate Picker Composition Boundary

将来のCandidate Pickerは次をserver-sideで合成する。

```text
authorized Worker scope
+ Worker active state
+ Skill / Qualification requirement facts
+ existing active Assignment duplicate check
= explainable candidate state
```

本Phaseに含めないfacts:

- Availability
- Shift間の移動 / overlap適否
- performance score
- rank / recommendation
- automatic placement

これらがない状態で`requirementsEligible = true`を「最終的に配置可能」と表示してはならない。

## Assignment and Placement Integration Rules

- existing Assignment rowsへSkill snapshotをコピーしない。
- existing Placement segmentへSkill / Qualification FKを追加しない。
- existing assignmentsをretroactiveにinvalid化、取消、削除しない。
- future assignment command integrationは、command execution時にShift start基準でserver-side再評価する。client-provided match resultをauthorization / eligibility proofにしない。
- requirement change後の既存Assignmentをどう扱うかは別Phaseで明示する。少なくとも本contractは自動取消を認めない。
- Placement UIはexisting Assignmentのcurrent mismatchをwarningとして説明できるが、Placement保存semanticsを変更しない。

## Duplicate Prevention

DB-level identity:

- Skill master: unique `code`
- Qualification master: unique `code`
- Staff Skill: primary key `(worker_id, skill_id)`
- Staff Qualification: primary key `(worker_id, qualification_id)`
- Job Skill requirement: primary key `(job_id, skill_id)`
- Job Qualification requirement: primary key `(job_id, qualification_id)`
- optional Shift requirements: corresponding `(shift_slot_id, master_id)` primary keys
- actual Shift assignment: existing `assignments_active_shift_worker_unique` remains canonical

SELECT-before-INSERTだけでduplicateを防止しない。normalized identityはcase / whitespace normalization ruleをschema PhaseでDB constraintまたはcanonical commandへ固定する。

## Authorization Boundary

Existing authorityを拡張しない前提:

- System Admin: master lifecycleとStaff holding mutationの第一候補
- Manager: own-Branch Staff holdings / candidate factsのread。mutation権限は別Phaseで明示承認するまで追加しない
- Worker: own holding readは将来UI要件として別途grant。今回暗黙に公開しない
- anon: accessなし

public schemaへ実装する場合は全tableでRLSを有効化し、Data API privilegeとRLSを別々に明示する。Manager Branch scopeは既存`private.has_branch_access(workers.branch_id)`を再利用する。generic authenticated accessやclient-side role trustは禁止する。

## Verification Matrix

| Contract requirement | Result |
| --- | --- |
| skill only | active Worker Skill presenceで表現可能 |
| qualification without expiry | nullable `expires_on` + expiry policyで表現可能 |
| qualification with expiry | `valid_from` / `expires_on`で表現可能 |
| expired qualification | Shift開始日基準のclosed `expired` state |
| inactive master | holdingを保持しつつmatchから除外、configuration reasonを返す |
| multiple qualifications per Staff | distinct Qualificationごとのcomposite PK row |
| duplicate holding / requirement | composite PK / unique codeでDB-level prevention |
| duplicate active Assignment | existing partial unique indexを維持 |
| requirement mismatch explanation | closed per-requirement resultとreason codeで説明可能 |

## Persistence Decision

Structured Skill / Qualification supportにはschema changesが必要である。

理由:

1. existing `jobs.requirements`は非構造化textでmaster FKを持たない。
2. Staff保有relationとDB-level duplicate identityが存在しない。
3. Qualification validity / expiry / revocation factsが存在しない。
4. Job / Shift requirementとmasterを安全に接続するFKが存在しない。
5. Candidate mismatchをclosed reasonとして再現できない。

ただしschema変更は本Phaseで実施しない。次Phaseはmaster + Staff holdingsを最小incremental migrationとして先に実装し、Job requirements / Candidate read modelを同時または後続Phaseとして明示的に分けられる。

## Explicit Non-Changes

- DB schema / RLS / RPC / migration: unchanged
- Worker / Staff lifecycle: unchanged
- Job free-text `requirements`: unchanged
- Assignment creation / status / duplicate semantics: unchanged
- Placement / Break / Coverage semantics: unchanged
- Candidate Picker UI: not added
- Availability / Open Shift: not added
- AI scoring / recommendation / automatic placement: not added
- payroll / back-office: unchanged
- Auth / packages / remote: unchanged
- commit / push: 0
- existing uncommitted work: preserved

## Next Phase Readiness

Recommended next boundary:

```text
STAFF-2B — Skill / Qualification Master and Staff Holding Persistence
```

It should implement the four canonical tables, constraints, RLS, narrow commands, and read tests without yet changing Assignment / Placement commands or building Candidate Picker UI.

`STAFF-2A: COMPLETE`
