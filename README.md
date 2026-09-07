<!--
Date: 2026-09-06
Update: 2026-09-07
Author: Alok
File: README.md
Purpose: Setup, workflow and implementation guide.
-->
# DocXtract example applications

Three independent local applications demonstrating the public DocXtract SDKs, plus a single-file folder watcher that calls the API directly. Each folder can be copied and run independently.

| Application | Backend | Open locally | Guide |
| --- | --- | --- | --- |
| Invoice Desk | Node.js | http://127.0.0.1:3101 | [Invoice guide](invoice-desk/README.md) |
| Resume Screening Desk | Python / Flask | http://127.0.0.1:3102 | [Resume guide](resume-desk/README.md) |
| PO vs Invoice Matcher | PHP | http://127.0.0.1:3103 | [Matcher guide](po-invoice-matcher/README.md) |
| Folder Watcher | PowerShell or Python script, no server | n/a (command line, writes Excel) | [Folder Watcher guide](folder-watcher/README.md) |

## Documentation

[Example applications overview](https://docs.docxtract.io/examples/overview) · [Invoice Desk](https://docs.docxtract.io/examples/invoice-desk-node) · [Resume Screening Desk](https://docs.docxtract.io/examples/resume-screening-python) · [PO vs Invoice Matcher](https://docs.docxtract.io/examples/po-invoice-matcher-php) · [Folder Watcher](https://docs.docxtract.io/connectors/folder-watcher)

## Launch

Install each app per its README, then run each application in a separate terminal:

```sh
cd invoice-desk
./start.sh
```

```sh
cd resume-desk
./start.sh
```

```sh
cd po-invoice-matcher
./start.sh
```

Folder Watcher has no server: copy `folder-watcher/` anywhere, drop files in `invoices/`, and run `.\folder-watcher.ps1` or `python folder_watcher.py`. See its README.

The launch guide opens automatically. Choose **Explore sample data** for a complete offline demonstration, or **Set up my profile** to connect a DocXtract key. Reopen the guide at any time from the header. Stop a server with Ctrl+C.

For a clean checkout, follow the install commands in each application's README. The applications bind only to `127.0.0.1`; they are local example applications, with no accounts, hosted database or public deployment.

## SDK availability verified on 2026-09-06

| Language | Official package used | Version | Public source |
| --- | --- | --- | --- |
| Node.js | `@docxtract/sdk` | 1.0.0 | [npm](https://www.npmjs.com/package/@docxtract/sdk), [public repository](https://github.com/docxtractio/node-sdk) |
| Python | `docxtract-sdk` (import `docxtract`) | 1.0.0 | [PyPI](https://pypi.org/project/docxtract-sdk/), [public repository](https://github.com/docxtractio/python-sdk) |
| PHP | `docxtract/php-sdk` | 1.0.0 | [Packagist](https://packagist.org/packages/docxtract/php-sdk), [public repository](https://github.com/docxtractio/php-sdk) |

The similarly named unscoped npm `docxtract` and PyPI `docxtract` packages are unrelated DOCX text utilities. These applications use the official SDKs listed above, installed from their public registries. References: [documentation](https://docs.docxtract.io), [API reference](https://app.docxtract.io/api-reference.php).

The SDK defaults to `https://api.docxtract.io` with base path `/v3.1`. `model` and `document_type` select the same document template; a nonblank model takes precedence. Invoice Desk sends `document_type: invoice` with no model override by default. Resume Desk defaults to `resume`. The PO profile initially proposes `purchase_order`; use model discovery to choose a template enabled for your account. No account-specific model availability is assumed.

## Profile and data handling

- Named profiles, model settings, field mappings and tolerances are stored in browser `localStorage`.
- API keys go into `sessionStorage`, remain available on reload in the same browser session, and are sent only to the corresponding localhost backend. SDKs run server-side. No key is written to project files, logs or exports.
- Results are kept in memory by default, separately for each profile. Enable **Keep extracted results in this browser after reload** to opt into local persistence. Upload queues are not retained when switching profiles. Browser data is local to each port and hostname; use the same URL consistently.
- Uploaded document bytes are held temporarily and removed in a `finally`/context-manager cleanup. SDK requests explicitly set `store_db: false`. The SDK may use temporary remote chunk jobs for multi-page PDFs; no application database is created.
- Live extraction sends documents to DocXtract and uses your account credits. Connection/model discovery does not consume extraction credits. The sample workspace never calls the extraction service.
- Full JSON exports contain original extraction data, current corrected data, correction notes/timestamps, metadata and comparison settings. CSV exports are flattened for review and escape spreadsheet formula prefixes.
- Clear removes the active workspace's results, not its profile or API key. Delete in Settings removes the selected profile and its saved local data.

## Frontend

Each app has reusable `.php` view fragments in `includes/`, common styles in `public/assets/styles.css`, shared helpers in `main.js`, and desk workflows in `app.js`. Node and Python concatenate these HTML-only `.php` view fragments; they do not require a PHP runtime. The PHP app uses `require_once __DIR__` to include them. Business logic runs in the app's own backend language. Bootstrap 5.3.8, Bootstrap Icons 1.13.1 and jQuery 3.7.1 are vendored locally; the UI makes no CDN requests.

## Verification

```sh
npm test --prefix invoice-desk
(cd resume-desk && .venv/bin/python -m unittest discover -s tests -v)
php po-invoice-matcher/tests/matching_test.php
```

Tests cover arithmetic errors, missing/zero values, rounding adjustments, strict number parsing, configurable mappings, ranking weights and ties, overlapping employment, irrelevant personal fields, ambiguous line identity, currency mismatches and tolerances. Node and Python integration tests mock the installed SDK contract and verify temporary-file cleanup and request-origin guards.

Browser verification covers the three sample flows, invoice corrections, ranking changes, local profile persistence, CSV/JSON downloads, and responsive layout. Live API tests were skipped for the initial publication; live account extraction remains unverified. Use **Test connection & load models**, then extract a real document to verify your account and chosen templates.
