# README and Runbook Standards

## README minimum viable sections

Every repository, service, and publishable library needs a README
that a new contributor (or a coding agent) can act on without asking a
human first. At minimum, include:

1. **Purpose** — one paragraph: what this is, why it exists.
2. **Setup / run instructions** — prerequisites, environment
   variables, local development commands.
3. **How to test** — the exact commands to run the test suite, and any
   coverage expectations.
4. **How to deploy** — the deployment process, or a link to the
   pipeline/runbook that performs it.

Recommended additions where relevant: **ownership** (team/contact and
escalation path), **architecture overview** (link to ADRs), and
**troubleshooting** (common failure modes and fixes).

### README skeleton

```markdown
# Order Service

Handles order placement, order lifecycle state, and order-to-fulfillment
handoff for the commerce platform.

## Prerequisites

- .NET 10.0 SDK
- Docker (for local PostgreSQL and Redis via Aspire)

## Setup

    dotnet restore
    dotnet run --project src/OrderService.AppHost

The Aspire dashboard will start local dependencies automatically.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `ConnectionStrings__OrdersDb` | PostgreSQL connection string | set by Aspire locally |
| `Redis__ConnectionString` | Cache connection string | set by Aspire locally |

## Testing

    dotnet test

Integration tests use Testcontainers and require Docker to be running.

## Deployment

Deployed via the `order-service` pipeline on merge to `main`. See
`docs/runbooks/deploy-order-service.md` for manual deployment and
rollback steps.

## Architecture decisions

See `docs/adr/` for the history of significant design decisions,
including `docs/adr/0042-use-postgresql-for-orders.md`.

## Ownership

Owned by the Commerce team (`#commerce-eng`). On-call escalation:
see `docs/runbooks/incident-response.md`.
```

### README anti-patterns

- **Outdated setup instructions.** A README that no longer works is
  worse than no README — it wastes a new contributor's time and
  erodes trust in all documentation in the repository.
- **Assumes tribal knowledge.** "Just run the thing" without naming
  the thing, the command, or the prerequisite.
- **No test or deploy instructions.** Forces every reader to reverse
  engineer the CI pipeline to find out how to validate or ship a
  change.
- **Copy-pasted boilerplate that was never adapted** to the actual
  service (e.g. template placeholders left unfilled).

## Runbooks

Runbooks document operational procedures: deployment, rollback,
incident response, scaling, and other actions an on-call engineer
needs to perform under time pressure. Because they are consulted
during incidents, they must be:

- **Version-controlled alongside the code and infrastructure they
  describe** — not in a wiki or chat pinned message, both of which
  drift silently and are not reviewed alongside the change that
  invalidates them.
- **Reviewed through the same PR process as code** — a runbook change
  that describes a new rollback mechanism should ship in the same PR
  that changes the deployment topology.
- **Concrete and executable** — exact commands, exact dashboard links,
  exact escalation contacts, not prose summaries of what "should"
  happen.

### Runbook skeleton

```markdown
# Runbook: Order Service Rollback

## When to use this

The `order-service` deployment is failing health checks or producing
elevated error rates after a release.

## Preconditions

- You have `kubectl` access to the `commerce` namespace.
- You know the previous known-good image tag (see the deployment
  pipeline's release history).

## Steps

1. Identify the previous stable revision:

       kubectl rollout history deployment/order-service -n commerce

2. Roll back:

       kubectl rollout undo deployment/order-service -n commerce --to-revision=<N>

3. Confirm health:

       kubectl rollout status deployment/order-service -n commerce

4. Notify `#commerce-eng` and update the incident ticket with the
   revision rolled back to and the observed symptom.

## Escalation

If the rollback does not resolve the issue within 10 minutes, page the
secondary on-call via PagerDuty and escalate to the Commerce team lead.
```

Store runbooks under `docs/runbooks/` in the same repository as the
service, alongside `docs/adr/` for design decisions.

## Preventing documentation drift

Documentation drift — a README, runbook, or ADR that no longer matches
reality — is the most common cause of documentation being ignored
entirely. Prevent it by treating any PR that changes a command,
config key, endpoint, version constraint, or deployment step as
incomplete until the referencing documentation is updated in the
**same PR**. Reviewers should block merge on stale documentation the
same way they would block on a failing test (see `common.code-review`,
`REVIEW-001`–`REVIEW-004`). Where possible, generate documentation
from source (OpenAPI specs, CLI `--help` output, XML/JSDoc-derived
reference docs) so it cannot drift independently of the code that
produces it.
