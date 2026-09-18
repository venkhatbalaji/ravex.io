# Enterprise requirements register

This is the delivery and release checklist for the free-to-play prediction
application. It is not a claim of enterprise certification or production
readiness. Passing functional tests does not establish security, capacity,
regulatory suitability, or disaster recovery. New requirements discovered
through threat modeling, operator feedback, and deployment design belong here.

Current deployment assumption: one active brand per deployment. Multi-tenant
SaaS is a separate architectural milestone. No real-money purchases or cash
withdrawals are implemented. Jurisdiction-specific obligations, age policy,
reward rules, retention periods, and contractual commitments need qualified
review against the final product and target markets before launch.

Statuses: **Implemented** means code exists with the evidence named below;
**Partial** means a narrower capability exists; **Open** requires implementation
or an explicit product/operations decision. These statuses apply to this repo,
not to infrastructure that may exist elsewhere.

## Delivery sequence

1. **Operational visibility (implemented baseline):** protected recovery backlog,
   Catalog processing decisions, database-aware readiness, outage tests, runbook.
2. **Security and economy controls (current phase):** verified rewards, abuse limits, session
   lifecycle, privileged identity controls, production secret/network defaults.
3. **Governance and market operations:** complete administrative audit events,
   fixtures, drafts/publication, result verification and dispute procedures.
4. **Production operations:** telemetry/alerts, capacity evidence, backup/restore,
   release automation, migration strategy, incident drills.
5. **Enterprise tenancy and integrations:** only after choosing the tenant model,
   isolation contracts, enterprise identity, quotas, and customer commitments.

A release must select explicit acceptance thresholds and responsible people.
An unassigned requirement is not complete. Suggested owner roles below must
be replaced with named owners during release planning.

## Product, market, and coin integrity

| ID | Requirement | Status | Acceptance evidence / remaining work | Owner |
| --- | --- | --- | --- | --- |
| PROD-01 | Earned-coin prediction lifecycle | Implemented | Gateway/browser tests cover claim, stake, result, payout/refund and history | Product/backend |
| PROD-02 | Idempotent debit and payout decisions | Implemented | Concurrency and lost-response/restart tests preserve balances and receipts | Wallet |
| PROD-03 | Exact allocation and refund policy | Implemented | Integer conservation tests; cancellation and no-backed-winner refunds | Settlement/product |
| PROD-04 | Server cutoff and closed admission | Implemented | Admission/closure race and pending-debit drain tests | Settlement |
| PROD-05 | Fixtures, competitions, teams and result sources | Open | Stable fixture IDs, validated feeds, corrections policy and provenance | Product/catalog |
| PROD-06 | Draft, review, publish and scheduled close | Open | Unpublished markets never accept stakes; schedule recovery tested | Catalog |
| PROD-07 | Ties, voids, abandonment and disputes | Partial | Cancellation exists; publish explicit per-market rules and a dispute process | Product |
| PROD-08 | Verified rewarded-ad/referral events | Partial — direct-claim abuse closed | Wallet rejects unverified ad/referral claims; provider rewards remain disabled until signed, replay-protected events and anti-fraud rules exist | Wallet/security |
| PROD-09 | Reconciliation and discrepancy handling | Partial | Test suite reconciles ledger and escrow; scheduled production checks, alerting and investigation workflow remain | Wallet/operations |
| PROD-10 | Search, category/status filtering and bounded lists | Implemented | Catalog/player/Admin filtering and pagination, bounded legacy list, empty/error states; [contracts and regression coverage](market-discovery.md) | Frontend/catalog |
| PROD-11 | Rankings and notifications | Open | Versioned scoring/season/tie rules; opt-in channels and idempotent delivery | Product |
| PROD-12 | Historical data upgrade | Open — existing-data blocker | Reconcile old in-memory pools and legacy settled records; no automatic repayment | Operations/wallet |

## Identity, security, and abuse resistance

| ID | Requirement | Status | Acceptance evidence / remaining work | Owner |
| --- | --- | --- | --- | --- |
| SEC-01 | Authorization at gateway and owning service | Implemented for current admin routes | Player/anonymous denial tests; repeat on every new sensitive route | Security/backend |
| SEC-02 | Fine-grained operator permissions | Open | Separate support, market editor, result approver and platform administrator; deny-by-default matrix | Identity/product |
| SEC-03 | MFA and enterprise SSO | Open | Admin MFA, recovery controls, OIDC/SAML design where customers require it | Identity |
| SEC-04 | Session renewal, revocation and logout | Partial | JWT login and reload restoration work; rotation, revocation and all-device logout remain | Identity/frontend |
| SEC-05 | Browser token and XSS protection | Open | Review localStorage token exposure; choose cookie/BFF or other session design, CSP and CSRF controls as applicable | Security/frontend |
| SEC-06 | Password reset and email verification | Open | Expiring one-use tokens, enumeration resistance, rate limits and mail delivery evidence | Identity |
| SEC-07 | Login, registration, earn and stake abuse limits | Partial | Per-process gateway quotas, 429/Retry-After and spoof-resistant keys implemented; distributed/edge limits, trusted-proxy deployment, service-level controls and load tests remain | Gateway/security |
| SEC-08 | Production secrets and signing-key rotation | Partial — production blocker | Startup rejects development credentials; secret-file loading implemented; secret-manager integration and tested key rotation remain | Platform/security |
| SEC-09 | Service identity and network isolation | Partial | Internal key enforced and private production backend network implemented; distinct service credentials, rotation and TLS/mTLS remain | Platform |
| SEC-10 | Least-privilege database roles | Partial — production blocker | Production service roles confined to their schemas; separate runtime and migration principals remain | Platform/backend |
| SEC-11 | Input, payload and resource limits | Partial | Stake and backlog parameters bounded; review all APIs, uploads, bulk writes and timeouts | Backend/security |
| SEC-12 | Vulnerability and supply-chain controls | Open | Dependency/container scans, remediation SLA, SBOM, pinned artifacts and secret scanning | Platform/security |
| SEC-13 | Threat model and independent security review | Open | Abuse cases, attack surface, penetration test and tracked remediation | Security |
| SEC-14 | Admin provisioning and emergency access | Partial | Bootstrap exists; invitations, removal, approvals and audited emergency access remain | Identity/operations |

## Governance, privacy, and customer trust

| ID | Requirement | Status | Acceptance evidence / remaining work | Owner |
| --- | --- | --- | --- | --- |
| GOV-01 | Complete administrative audit trail | Partial | Results record actor/evidence/timestamps; other mutations need atomic append-only events, retention and viewer | Backend/security |
| GOV-02 | Dual control for sensitive decisions | Open | Decide which changes need a second approver; prevent self-approval | Product/security |
| GOV-03 | Data inventory and classification | Open | Inventory personal data, credentials, coin records, logs, caches and third parties | Privacy/platform |
| GOV-04 | Retention, export and deletion | Open | Approved schedules and workflows respecting ledger/audit preservation; backup expiry behavior | Privacy/backend |
| GOV-05 | Terms, age/eligibility and reward disclosures | Open — launch decision | Qualified review of the actual free-to-play model and target markets; documented consent/eligibility flow | Product/legal |
| GOV-06 | Accessibility and localization | Partial | IST displays and labelled forms; keyboard/screen-reader/mobile audits, accessible errors and localization coverage remain | Frontend/product |
| GOV-07 | Support and incident communication | Open | Support permissions, escalation, user notifications and dispute handling | Support/operations |
| GOV-08 | Data residency and vendor review | Open | Hosting/backup regions, subprocessors and contractual requirements decided | Privacy/platform |

## Reliability, observability, and delivery

| ID | Requirement | Status | Acceptance evidence / remaining work | Owner |
| --- | --- | --- | --- | --- |
| OPS-01 | Durable recovery without user tokens | Implemented | Debit and payout restart/outage tests | Settlement/wallet |
| OPS-02 | Admin recovery backlog | Implemented in current increment | Protected snapshot, pagination, pending age and Catalog decisions; API/browser tests | Operations/backend |
| OPS-03 | Liveness separate from readiness | Implemented in current increment | DB outage returns readiness 503 while liveness stays 200; gateway checks downstream readiness | Platform/backend |
| OPS-04 | Monitoring, tracing and correlation | Partial | Service logs have operation IDs; standardized traces, redaction, metrics and dashboards remain | Platform |
| OPS-05 | SLOs, alert thresholds and on-call response | Open | Choose availability/latency/settlement-age objectives; test alerts and escalation | Operations/product |
| OPS-06 | Backup and point-in-time restore | Open — production blocker | Encrypted backups plus timed restore drill and reconciled balances; approved RPO/RTO | Platform/wallet |
| OPS-07 | High availability and disaster recovery | Open | Failover topology, recovery runbook, regional failure and dependency drills | Platform |
| OPS-08 | Capacity and performance | Open | Agreed concurrency/data-volume targets; p95/p99/load/soak evidence and query plans | Backend/platform |
| OPS-09 | Migration and rollback strategy | Partial | Versioned migrations exist; separate deployment migration job, compatibility and roll-forward/rollback drills remain | Backend/platform |
| OPS-10 | Repeatable builds and release promotion | Partial | Compose and CI functional suite work; environment promotion, approvals, signed images and rollback automation remain | Platform |
| OPS-11 | Frontend production packaging | Open | Reproducible production images, runtime configuration and edge/TLS deployment | Frontend/platform |
| OPS-12 | API lifecycle and contract compatibility | Partial | OpenAPI exists; versioning/deprecation policy and compatibility tests remain | Backend |
| OPS-13 | Automated quality gates | Partial | Typechecks, real-service/Postgres and Chromium tests run in CI; security, load and accessibility gates remain | Engineering |
| OPS-14 | Event delivery and outbox | Open when needed | Add transactional outbox, deduplication and poison-message handling before using NATS for product events | Backend |
| OPS-15 | Incident and change management | Open | Named on-call, severity levels, change log, incident exercises and postmortems | Operations |

## Enterprise tenancy and commercial integration

| ID | Requirement | Status | Acceptance evidence / remaining work | Owner |
| --- | --- | --- | --- | --- |
| TEN-01 | Tenant model and isolation boundary | Open | Choose deployment-per-brand versus shared tenancy; cross-tenant denial tests required for shared hosting | Architecture/product |
| TEN-02 | Tenant-aware identity, ledger and result ownership | Open for shared SaaS | Propagate validated tenant identity, constrain every query, cache key, job and receipt | Backend/security |
| TEN-03 | Provisioning, suspension and offboarding | Open | Idempotent lifecycle with data export/retention and background-work policies | Platform/product |
| TEN-04 | Branding, domains and certificates | Partial | One deployment-wide theme/copy; tenant-specific domains/certs and asset storage remain | Frontend/platform |
| TEN-05 | Quotas and noisy-neighbor isolation | Open | Tenant resource budgets, rate limits, capacity controls and metering | Platform |
| TEN-06 | Customer SSO, SCIM and access reviews | Open when contracted | Tenant-bound federation and deprovisioning tests | Identity |
| TEN-07 | External integrations and webhooks | Open when needed | Auth, signed delivery, retry/deduplication, secrets rotation and versioned contracts | Backend |
| TEN-08 | SLA, support, billing and service ownership | Open | Agree customer commitments and charge model; avoid conflating SaaS billing with player coins | Business/operations |

## Evidence and release gates

The previous increment's GitHub workflow run `34569970676` passed. On
2026-09-14, the operations increment passed local `npm run test:all`: workspace
typechecks, real-service/PostgreSQL checks, Go tests/vet, and Chromium. This
includes protected backlog pagination/privacy, stalled-connection deadlines,
database pause/recovery, and browser stale-data warnings. No production
deployment or new remote CI run is implied. See [operations runbook](operations.md) and
[settlement/testing contracts](settlement-and-testing.md).

The reward-policy increment also passed `npm run test:all`: rejection of
unverified ad/referral claims through Gateway and direct Wallet, server-owned
amounts and recipients, read-only claim availability, concurrent daily claims,
restart persistence, simulated UTC reset, and the browser claim/reload flow.
Provider integration remains unimplemented and provider rewards remain disabled.
See [reward contracts](rewards.md).

On 2026-09-15, the gateway-limit increment passed local `npm run test:all`,
including quotas, forwarded-header spoof resistance, user isolation, retry
headers, reset behavior, and the existing backend/Chromium regressions.
The pushed reward commit `4892bfa` also passed GitHub workflow `34932079656`.
See [request limits](request-limits.md) for the per-process and proxy boundaries.

On 2026-09-18, the market-discovery increment passed all workspace typechecks,
`npm run test:ui` (backend/PostgreSQL, Go tests/vet and all three Chromium journeys),
and `npm run test:production`. Coverage includes catalog bounds and combined
filters, processing decisions beyond the first page, browser pagination and
error recovery, and same-key retry after a lost response and market closure.
See [market discovery](market-discovery.md) for the legacy-list cap and remaining
capacity/clock limitations.

A beta release requires, at minimum, keeping unverified rewards disabled, agreeing
eligibility/terms, securing deployment credentials/networks, assigning support
and incident ownership, and reconciling any legacy data. A production release
also needs backup/restore evidence, capacity targets and test results, migration
and rollback drills, security review, and signed-off operational objectives.
Shared SaaS additionally requires tenant isolation tests across every service
and background job. None of these gates should be inferred from a green unit
or browser test suite alone.

Production configuration and deployment limitations: [deployment baseline](production-deployment.md).
