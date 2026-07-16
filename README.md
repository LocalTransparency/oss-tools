# Local Transparency — OSS Tools

Open-source, show-the-math civic tools. Each tool lives in its own directory,
is independently deployable, and keeps every figure it displays in a single
sourced configuration file so anyone can verify the numbers behind the
analysis.

## Tools

| Tool | Path | Serves at |
|---|---|---|
| Noblesville Schools 2026 referendum tax estimator | [`noblesville/2026-school-referendum/`](noblesville/2026-school-referendum/) | `noblesville.localtransparency.com/tools/2026-school-referendum` |

## Layout

Tools are grouped by locality: `<locality>/<tool>/`. Each tool directory is a
self-contained app with its own README, dependencies, and test suite. The
root `amplify.yml` uses AWS Amplify's monorepo format — each tool is a
separate Amplify app pointing at its `appRoot`.

## Principles

- **Neutral:** tools present facts and math, not advocacy.
- **Sourced:** every displayed figure carries a citation to an official source.
- **Private:** nothing a visitor enters is stored or logged.
- **Verifiable:** the math runs in the open — read it, test it, reproduce it.

## License

[MIT](LICENSE) © Local Transparency. Reuse it, fork it, build your own local
tools — attribution appreciated. Contributions are governed by
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).
