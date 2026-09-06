<!--
Date: 2026-09-06
Author: Alok
File: CONTRIBUTING.md
Purpose: Contribution scope and local verification.
-->
# Contributing

Open an issue before proposing a feature or a broad change. For a bug, include the app,
runtime and SDK versions, reproduction steps, and synthetic inputs. Never include API keys
or real documents in issues or fixtures.

Keep changes focused and the apps independent and dependency-light. Use the public
DocXtract SDKs. Keep browser assets local: no CDN assets. Do not add server-side storage of
API keys, uploaded documents or extraction results. Temporary upload files must be cleaned
up on success and failure.

Install dependencies using each app's README, then run all three suites:

```sh
npm test --prefix invoice-desk
(cd resume-desk && .venv/bin/python -m unittest discover -s tests -v)
(cd po-invoice-matcher && composer test)
```

Tests must work offline, without an API key. Include a focused regression test for a bug and
check the sample-data workflow when changing the UI. Screenshot fixtures must contain only
synthetic sample data. Keep the existing folder names because documentation links use them.

By contributing, you agree that your contributions are licensed under the repository's MIT
license.
