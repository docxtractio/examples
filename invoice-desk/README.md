<!--
Date: 2026-09-06
Author: Alok
File: invoice-desk/README.md
Purpose: Setup, workflow and implementation guide.
-->
# Invoice Desk · Node.js

Drop invoices → extract headers and line items → validate arithmetic → flag exceptions → export CSV/JSON.

Read the [documentation article](https://docs.docxtract.io/examples/invoice-desk-node).

## Install and run

Requires Node.js 20+ and npm. No other runtime or database is required.

```sh
npm ci
npm start
```

Open [Invoice Desk](http://127.0.0.1:3101). You can also run `./start.sh`. Override the port with `PORT=3201 npm start`.

## What to demonstrate

Choose **Explore sample data** in the guide. Three synthetic invoices produce one validated invoice and two reviews: a line multiplication mismatch and a missing tax amount. Open Acme's review to see a 50.00 line difference even though its subtotal and total agree. Correct the source fields, add a note, and watch the validation update.

The initial profile leaves the model blank and uses document type `invoice`, allowing the SDK/API default. The model is configurable in Settings.

## Validation rules

- Each line: quantity × unit price − line discount = line amount.
- Line amounts sum to the invoice subtotal.
- Subtotal + tax − document discount + shipping + rounding = total.
- Missing invoice number, vendor, currency, line items, numeric operands or required totals require review. Missing tax is unknown, not zero. Explicit zero is accepted.
- A header tax may be read directly or summed from present `cgst`, `sgst`, `igst` and `vat` amounts. Percentage strings are not treated as tax amounts.
- Duplicate vendor + invoice-number pairs in the current workspace are flagged.
- Default absolute tolerance is 0.01 currency units, configurable from 0 to 100. The example application rounds arithmetic to two decimals; custom currencies or tax-inclusive line schemas should be reviewed/mapped before use.
- Optional absent discounts/shipping/rounding are treated as no adjustment. Present but invalid adjustment values require review. Decimal-comma strings are not guessed; use numeric JSON or unambiguous dot-decimal values.

The CSV has one row per invoice line with invoice identity, vendor, currency, total, quantity, price, amount and exceptions. JSON retains the entire extraction and review trail.

## Field mapping

The default schema uses `invoice_number`, `vendor.name`, `currency`, `line_items`, `subtotal`, `tax`, `total`; common aliases such as `items`, `qty`, `unit_price` and `grand_total` are supported. Keys are case/punctuation insensitive; nested containers are explicit.

Supported mapping keys: `number`, `vendor`, `currency`, `date`, `subtotal`, `tax`, `total`, `discount`, `shipping`, `rounding`, `items`; row-relative keys: `description`, `sku`, `quantity`, `rate`, `amount`, `itemDiscount`.

Example custom mapping:

```json
{"number":"Header.InvoiceNumber","vendor":"Header.SupplierName","items":"LineItems","quantity":"Qty","rate":"UnitPrice","total":"Totals.GrandTotal"}
```

## Code and tests

- `server.js`: one API module with `/api/connect`, `/api/extract`, `/api/analyse`; uses `new DocXtract(...)` and `dx.extract(file, {document_type, model?, store_db:false})`.
- `includes/invoices.js`: normalization and arithmetic checks.
- `includes/config.js`: server port, upload limit and defaults.
- `includes/*.php`, `public/assets/`: reusable view components, styles and jQuery behavior.

```sh
npm test
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
