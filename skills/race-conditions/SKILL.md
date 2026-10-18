---
name: race-conditions
description: Assess race conditions during programming, code review, and bug investigation. Use whenever a possible concurrency issue, lost update, duplicate operation, or race-condition bug report appears. Estimate real-world likelihood and impact before deciding to fix or defer; require the user to choose a fix for reported incidents.
---

# Race conditions

Do not fix every theoretically possible race. Decide using realistic likelihood, consequences, and recovery cost—not the mere existence of concurrent code.

## Assess before deciding

1. Read the affected flow and its callers, including database constraints, transaction boundaries, background jobs, retries, and external side effects. Check whether existing protections already prevent the race.
2. Describe a concrete interleaving in this project: who performs operation A, who performs B, what overlaps, and what incorrect result follows. Distinguish a demonstrated race from a hypothesis.
3. Estimate likelihood as low, medium, high, or unknown, with reasons. Consider how often the same data changes, concurrent actors, the overlap window, traffic, automatic retries, multiple tabs, workers, and production evidence. Do not invent numerical probabilities or treat missing evidence as proof of rarity.
4. Assess impact separately: persistent database inconsistency, lost data, duplicate irreversible effects, financial/security harm, or merely a temporary error/stale display. Verify whether retrying is actually safe and sufficient; a retry cannot undo corruption or duplicated side effects.

## Fix, defer, or ask

- **Must fix:** a credible race can critically compromise database consistency, cause serious data loss, or cause comparably serious harm. Low likelihood does not excuse critical consequences. In review, flag it as requiring a fix; do not silently edit code when only a review was requested.
- **Usually defer:** low-impact failures that users can safely recover from by clicking again. Prefer waiting for real production cases over adding speculative concurrency machinery.
- **Defer rare, noncritical admin races:** if an infrequently edited admin field could be updated simultaneously but has no critical consistency implications, leave it alone even when the race is real. For example, two admins changing a cosmetic label once every few months usually does not justify locking infrastructure. A rare lost update to a noncritical description or label (the second admin's save overwrites the first) is not critical database inconsistency and should normally be deferred. Judge lost updates by the business impact of the affected data, not simply because a change was overwritten. Admin-only access is not an exemption for critical data.
- **Ask when uncertain:** if likelihood, consequences, or the trade-off is unclear, ask the user to decide before implementing a race-specific change. Give a concrete project-specific sequence, the resulting user/data impact, your likelihood estimate and assumptions, and a recommendation: fix now or defer. Ask only for missing facts that would change that decision.

When deferring, briefly state why and what would trigger reconsideration, such as a production incident or increased concurrent use. Do not present a deferred theoretical race as a blocking review finding. Do not add locks, retries, dependencies, monitoring infrastructure, or unrelated refactors just to cover hypothetical cases.

## When the user brings a reported race-condition bug

A bug-tracker report is evidence of a real incident; do not dismiss it merely because the workflow seems rare.

Before implementing:

1. Investigate the report and code. Explain a realistic example of how the incident could have happened in this project, with the operations in order. Label it as a plausible explanation unless logs, reproduction, or code establish the cause.
2. Suggest the smallest effective fix, or multiple meaningful alternatives when available. For each, explain how it prevents the race, relevant limitations, and costs such as contention, retry behavior, migration, or changed user experience. Recommend one; do not manufacture alternatives.
3. **Stop and ask the user to choose or explicitly approve the fix.** Even if only one fix makes sense, obtain approval. A request to “fix this bug” alone is not selection of an approach. Critical severity does not bypass this gate. If the user already explicitly chose an approach, do not ask redundantly unless investigation changes it.

## After the decision to fix

Use the project's existing mechanisms and the smallest protection at the actual consistency boundary. Check all writers: a UI button guard or process-local lock does not protect against other clients, workers, or server instances. Do not assume a transaction alone prevents every race; verify the relevant isolation and constraints. Make retries bounded and safe for side effects.

Add a focused regression test that forces the problematic interleaving where practical, rather than relying on arbitrary sleeps. Verify the invariant or user-visible outcome, and report any concurrency behavior that could not be tested.
