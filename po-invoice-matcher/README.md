<!--
Date: 2026-09-06
Author: Alok
File: po-invoice-matcher/README.md
Purpose: Setup, workflow and implementation guide.
-->
# PO vs Invoice Matcher · PHP

Upload a PO + invoice → extract both → compare quantities, prices, amounts and tax → inspect mismatches → export.

Read the [documentation article](https://docs.docxtract.io/examples/po-invoice-matcher-php).

## Install and run

Requires PHP 8.1+, the curl/json extensions, and Composer.

```sh
composer install
composer start
```

Open [PO vs Invoice Matcher](http://127.0.0.1:3103). After installation, use `./start.sh`. Equivalent command or alternate port:

```sh
php -d post_max_size=16M -d upload_max_filesize=10M -S 127.0.0.1:3103 -t public router.php
```

Keep `-t public` and the router: only public assets and the combined API are exposed. Use these local launch commands; a shared-hosting rewrite setup is not included.

## What to demonstrate

Choose sample data. The PO orders 4 monitors at 200.00 and 4 keyboards at 40.00; the invoice bills 5 monitors and raises the keyboard price to 45.00. The matcher finds quantity, price, line amount, tax and header-total differences. Expected and actual values are shown side by side, with differences; open either document's Review to inspect/correct its JSON. Comparison after a correction makes no extraction call.

Invoice model is blank with document type `invoice`. PO model/type default to `purchase_order`, editable in Settings. This is a starting template name, not a guarantee that every key has it enabled. Test the connection and choose an available PO template. There are separate field mappings for invoice and PO.

## Matching rules

- Prefer unique item/SKU codes. If an invoice item lacks a code, allow an exact normalized description match. When a PO line has no code, its unique description is the identity.
- Never match by array position or guess a fuzzy description. Duplicate identities and ambiguous candidates require review. Conflicting non-empty SKUs do not match by description.
- For paired lines, compare quantity, unit price, amount and line tax. Missing values remain unknown; missing tax does not imply zero. Where a document has no line tax, reconciliation stays flagged even if header tax matches.
- Compare currency, vendor, PO reference, subtotal, total tax and grand total. Currency differences remain exceptions; no currency conversion is attempted.
- Money tolerance defaults to 0.01; quantity tolerance defaults to 0. Both are configurable, from 0 to 100. Differences are absolute, not percentage tolerances.
- Every unmatched line on either side is retained. Blank line-item sets and partial extractions cannot produce a clean match.
- This desk compares a single complete PO to a single invoice. Partial delivery billing, many-to-one line aggregation, currency conversion and tax-inclusive schema normalization need manual review. The comparison does not approve payment.

## Field mapping

Header keys: `number`, `poReference`, `currency`, `vendor`, `subtotal`, `tax`, `total`, `items`. Row-relative keys: `sku`, `description`, `quantity`, `rate`, `amount`, `lineTax`.

Typical schema: `po_number` or `invoice_number`, `vendor.name`, `currency`, `line_items`, `subtotal`, `tax`, `total`. The invoice should carry the PO reference as `po_number` or an equivalent mapped field.

```json
{"number":"Header.InvoiceNumber","poReference":"Header.PurchaseOrder","items":"Details","quantity":"Qty","rate":"UnitPrice","lineTax":"TaxAmount"}
```

## Code and tests

- `public/api.php`: combined routes `/api/connect`, `/api/extract`, `/api/match`; uses `DocXtract\DocXtract` and `extract($file, $options)`.
- `includes/matching.php`: normalization and one-to-one comparison.
- `includes/config.php`: SDK defaults and upload limit.
- `public/index.php`: reusable `require_once __DIR__` view includes.
- `router.php`: local public routes.

```sh
composer test
```

## Connection and first use

1. Open the local URL. The launch guide explains the desk workflow.
2. Open **Settings**, name the default profile or choose **New profile**, and enter a DocXtract key beginning with `sk_`.
3. Choose **Test connection & load models** to authenticate and populate model suggestions without extracting a document. Pick an allowed template or type one manually.
4. Save the profile. You may leave the key blank to explore sample data.
5. Select or drop PDF, PNG or JPG files, at most 10 MB each (up to 20 queued files). Convert Word CVs/documents to PDF before uploading. The official SDK manages multi-page PDFs automatically, subject to the service's limits.
6. Choose **Extract documents**, keep the tab open, then review the results. Failed files stay queued for an explicit retry. A batch continues past an individual failure.

Models are document-template names, not underlying LLM providers. A nonblank **Model override** takes precedence over **Document type**. Leave the override blank to use the document type/API default.

## Storage and review

Profiles are browser-local. Keys persist only for the browser session and are never exported. Results stay in memory unless you opt into local persistence in Settings. Each profile has its own results. Switching a profile clears its upload queue. Do not close or refresh during extraction.

**Review** opens the source fields and editable extraction JSON. Enter a correction note to apply changes. Original data and correction history remain in the JSON export. Changing extraction settings invalidates existing comparisons; rerun the comparison after any correction or criteria change. Corrections and comparisons make no DocXtract API calls.

Use **CSV** for a flat report and **JSON** for source data, metadata, comparison evidence and corrections. A sample export is explicitly marked `sample: true`. Export before using **Clear** if you want a copy of the workspace. Stored data is not encrypted browser storage; keep keys session-only and use the local app on your own machine.

## Troubleshooting

- **No key / invalid key:** copy the key from [DocXtract Settings](https://app.docxtract.io); keys start with `sk_`, not `sk-`.
- **Unknown model:** test the connection, choose a model enabled for the account, then save the profile. Document types can differ by account.
- **Quota/rate limit/network errors:** the SDK handles its documented retry behavior; inspect the displayed message. Failed files remain queued. Do not repeatedly resubmit a still-running extraction.
- **Partial extraction:** inspect the raw metadata and missing pages. A partial result is flagged for review and cannot produce a clean validation/ranking/match.
- **Empty or differently shaped fields:** use Settings → Field mapping to map the extraction schema. Paths are relative to the SDK's `data` object; do not prefix them with `data.`. Review against the source before correcting.
- **Browser storage full:** export results and disable result persistence or clear old profiles. The app continues in memory.
- **Server unavailable:** restart it from the terminal and open the correct local port. App routes are same-origin and intended for local use.

Extraction uses account credits. The sample flow and local comparisons are free of API calls. SDK dependency versions are pinned for reproducibility. No live extraction was tested without an account key.
