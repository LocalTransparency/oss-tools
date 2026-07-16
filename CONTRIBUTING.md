# Contributing to Local Transparency OSS Tools

Thanks for your interest. This project is **open source so the math can be
audited**, not because it accepts open-ended contributions. The bar for merging
code is deliberately high, and the process below exists to keep every tool
neutral, sourced, and verifiable.

Please read this whole file before opening an issue or a pull request. It will
save us both time.

## The one rule that governs pull requests

> **A pull request is only reviewed and merged if it is tied to an issue a
> maintainer has already approved — or if a maintainer opened it.**

Concretely:

* Every PR must reference an open issue that carries the **`approved`** label
  (e.g. `Closes #123`). The `approved` label is applied only by a maintainer,
  and only after the underlying issue has been discussed and accepted.
* PRs that reference no issue, or reference an issue that is **not** labeled
  `approved`, will be closed without review. This is not a judgment about the
  code — it just means the change wasn't agreed to first.
* Maintainers may open and merge their own PRs directly; they don't need a
  separate approved issue.

This "issue-first" model means **no work is wasted.** Talk to us before you
write code, and you'll never have a PR closed for being unsolicited.

## Where to start: Discussions vs. Issues

We use two separate surfaces on purpose:

| You want to… | Use |
|---|---|
| Ask *why* something is built the way it is, float an idea, debate methodology, or ask a question | **[Discussions](https://github.com/localtransparency/oss-tools/discussions)** |
| Report a concrete, reproducible bug **or** propose a specific, actionable change | **[Issues](https://github.com/localtransparency/oss-tools/issues)** |

Discussions are for thinking out loud. Issues are the **actionable queue** — the
only thing a PR is allowed to target. A maintainer will move a discussion into
an issue (and eventually label it `approved`) when it's concrete and accepted.
Please don't skip the discussion step for anything non-trivial; opening an issue
does not by itself mean the change is approved.

## The workflow, end to end

1. **Discuss** the idea (Discussions) or **file** a specific bug/change (Issues).
2. A maintainer triages. If it's actionable and in scope, they apply the
   **`approved`** label. That's your green light.
3. **Fork**, branch, and make the change. Keep it small and focused on the one
   approved issue.
4. Open a PR that says `Closes #<the approved issue>`. Fill out the PR template.
5. A maintainer reviews. Merges are restricted to maintainers, so nothing lands
   without an explicit maintainer merge.

## What's in scope

* Bug fixes in existing tools.
* Corrections to a sourced figure (must cite the official source — see below).
* Accessibility, performance, and test improvements.
* New tools or datasets **only** after discussion and an `approved` issue.

## What's out of scope

* **Advocacy.** These tools present facts and math, not positions. No language
  (in code, copy, or commit messages) that argues for or against any measure,
  campaign, or candidate. See the [Code of Conduct](CODE_OF_CONDUCT.md).
* **Unsourced numbers.** Every displayed figure must trace to an official
  source in the tool's sourced configuration (e.g.
  `lib/tax/assumptions.ts`). PRs that hardcode a figure or change one without a
  citation will not be merged.
* Large refactors or dependency changes without a prior `approved` issue.

## Commit and PR requirements

* **Sign your commits.** `main` requires cryptographically **signed commits**.
  See GitHub's guide on
  [signing commits](https://docs.github.com/en/authentication/managing-commit-signature-verification)
  (SSH signing is the simplest path). Unsigned commits cannot be merged.
* **Sign off** each commit under the
  [Developer Certificate of Origin](https://developercertificate.org/) by
  committing with `git commit -s`. This adds a `Signed-off-by:` line certifying
  you have the right to submit the change under the project's license.
* **Keep history linear and focused** — one approved issue per PR, rebased on
  the latest `main`.
* **Run the tests** (`npm run test` inside the tool directory) before pushing;
  CI must be green.

## Code of Conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). To
report a security vulnerability, follow [SECURITY.md](SECURITY.md) — **do not**
open a public issue for vulnerabilities.
