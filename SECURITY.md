# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, use GitHub's private reporting:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability** to open a private advisory visible only to
   the maintainers.

If you cannot use private reporting, email **dmcnelis@gmail.com** with the
details and we'll take it from there.

Please include, as best you can:

* the tool and URL or file affected,
* a description of the issue and its impact,
* steps to reproduce (a proof of concept helps),
* any suggested remediation.

## What to expect

* We aim to acknowledge a report within **5 business days**.
* We'll work with you to understand and validate the issue, and keep you updated
  as we develop a fix.
* We'll credit you in the advisory when a fix ships, unless you'd prefer to
  remain anonymous.

## Scope

These tools are intentionally **stateless about visitors** — nothing a visitor
enters (such as a looked-up address) is stored or logged. Reports that are
especially in scope:

* anything that would cause visitor input to be stored, logged, or exfiltrated,
* injection, authentication/authorization flaws, or exposure of secrets or
  infrastructure,
* supply-chain concerns in the build or deploy pipeline.

Out of scope: volumetric denial-of-service, findings that require a compromised
maintainer machine, and reports against third-party services we merely link to
(e.g. county property-record systems).

Thank you for helping keep Local Transparency safe.
