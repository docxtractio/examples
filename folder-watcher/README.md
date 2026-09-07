<!--
Date: 2026-09-01
Update: 2026-09-07
Author: Alok
File: README.md
Purpose: Setup and usage guide for the DocXtract Folder Watcher (PowerShell and Python variants).
-->
# DocXtract Folder Watcher

Drop invoices in a folder, run one command, get an Excel workbook. The watcher extracts every
PDF or image in `invoices/` through the DocXtract API, writes the results to Excel, moves each
processed file to `done/`, and moves any failure to `failed/` so nothing is lost or reprocessed.

No SDK, no web app, no database. Two equivalent single-file implementations; pick one:

| Variant | File | Best for |
|---|---|---|
| PowerShell | `folder-watcher.ps1` | Zero-install: runs on any Windows machine as-is |
| Python | `folder_watcher.py` | Windows, macOS, or Linux with Python 3.9+; can be packaged as a single `.exe` |

Both call `POST /v3.1/documents` with the platform defaults: **document type `invoice`, model
`default`**. Documentation: [Folder Watcher](https://docs.docxtract.io/connectors/folder-watcher).

```
invoices/  ──▶  DocXtract API v3.1  ──▶  output/invoices.xlsx (or one .xlsx per invoice)
                                          └── processed file moved to done/
```

## Folder layout

| Folder | Purpose |
|---|---|
| `invoices/` | Drop PDFs / images here (pdf, jpg, jpeg, png, webp) |
| `done/` | Successfully processed files are moved here (duplicates get a timestamp suffix) |
| `failed/` | Files that errored (bad file, API error) are moved here |
| `output/` | The generated Excel workbook(s) |

All folders are created automatically on first run and are configurable.

## Configuration

Both variants share the same settings; only where they live differs.

| Setting | Default | Meaning |
|---|---|---|
| `api_url` | `https://api.docxtract.io/v3.1/documents` | DocXtract endpoint |
| `api_key` | (required) | Your DocXtract API key (Bearer auth) |
| `in_folder` | `invoices` | Folder scanned for PDFs/images |
| `done_folder` | `done` | Where processed files are moved |
| `failed_folder` | `failed` | Where errored files are moved |
| `out_folder` | `output` | Where Excel file(s) are written |
| `excel_mode` | `single` | `single` = one appending `invoices.xlsx`; `separate` = one `.xlsx` per invoice |
| `model` | *(blank)* | Model name to request. Blank = not sent, API default applies (`default`) |
| `document_type` | *(blank)* | Document type to request. Blank = not sent, API default applies (`invoice`) |

`model` and `document_type` are only included in the request when set. A blank value means the
`options` field is omitted and the platform defaults decide.

**API key resolution order (both variants):** command-line flag → config value →
`DOCXTRACT_API_KEY` environment variable → interactive prompt. On an interactive first run with
no key, the watcher asks once and saves it (Python: `config.ini` next to the script;
PowerShell: the `DOCXTRACT_API_KEY` user environment variable). Headless or scheduled runs
never prompt; they fail fast with a clear error.

Relative folder paths resolve against the script's own folder, so the whole thing is portable.

- **PowerShell:** every setting is a script parameter (`-ApiKey`, `-InFolder`, `-ExcelMode`,
  `-Model`, `-DocumentType`, ...). Defaults are in the `param()` block at the top of the script.
- **Python:** the first run creates `config.ini` next to the script with the defaults above.
  Edit that file to change behaviour permanently, or override per run with flags
  (`--excel-mode separate`, `--document-type passport`, `--in-folder D:\scans`, ...).

## Setup: PowerShell variant

1. Copy `folder-watcher.ps1` to any folder on the Windows machine.
2. Set your API key once (recommended), or pass it per run with `-ApiKey`:

```powershell
[Environment]::SetEnvironmentVariable("DOCXTRACT_API_KEY", "your_api_key_here", "User")
```

3. First run only, allow local scripts if needed:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

The script installs the `ImportExcel` PowerShell module for the current user on first run.

### Usage

One workbook, one row per invoice (default). Line items from all invoices land on a second
`LineItems` sheet, linked by `source_file`. Re-running appends to the same workbook.

```powershell
.\folder-watcher.ps1
```

One Excel file per invoice (`output\<invoicename>.xlsx`, with `Invoices` and `LineItems` sheets):

```powershell
.\folder-watcher.ps1 -ExcelMode separate
```

All parameters:

```powershell
.\folder-watcher.ps1 `
    -InFolder ".\invoices" `
    -DoneFolder ".\done" `
    -FailedFolder ".\failed" `
    -OutFolder ".\output" `
    -ExcelMode single `
    -ApiUrl "https://api.docxtract.io/v3.1/documents" `
    -ApiKey "your_api_key_here" `
    -Model "" `
    -DocumentType ""
```

## Setup: Python variant

Python 3.9 or later on Windows, macOS, or Linux:

```sh
pip install requests openpyxl
python folder_watcher.py                     # first run creates config.ini
python folder_watcher.py --excel-mode separate
```

### Building a single executable (optional)

A prebuilt binary is not published yet. To build one yourself for machines without Python:

```powershell
pip install requests openpyxl pyinstaller
pyinstaller --onefile --name DocXtractFolderWatcher folder_watcher.py
```

The executable lands in `dist\`. Copy that one file to the target machine and run it; on first
run it creates the working folders, asks for your API key, and saves it to `config.ini` next to
itself. Add `--icon app.ico` for a branded icon.

PyInstaller does not cross-compile: build on Windows for an `.exe`, on a Mac for a Mac binary.
Unsigned executables are sometimes flagged by SmartScreen or antivirus on first run; "Run
anyway", an exclusion, or code-signing resolves it.

## API key security

- The key is only ever sent as an `Authorization: Bearer` header over HTTPS. It never appears
  in URLs, filenames, or the Excel output.
- At rest it is stored in plain text: `config.ini` (Python) or the per-user `DOCXTRACT_API_KEY`
  environment variable (PowerShell). Both are readable only by that user account under normal
  permissions; on macOS/Linux the Python variant sets `config.ini` to mode 600. This is the
  same model as AWS or Git credentials, but anyone who can log in as that user can read the key.
- Use a dedicated API key for this watcher so it can be revoked from the DocXtract portal
  without affecting other integrations. Never commit `config.ini` (it is gitignored here).
  Rotate the key if a machine is shared or decommissioned.

## Output format

- **Invoices sheet**: one row per invoice: `source_file`, `processed_at`, then every scalar
  field from the extraction (nested objects flattened to dot-notation columns, e.g.
  `vendor.gstin`).
- **LineItems sheet**: one row per line item across all invoices, with `source_file` to join
  back to the invoice row.

Because a document type returns a consistent schema, columns stay stable across runs; a new
field simply appears as an extra column.

## Run on a schedule (optional)

Windows Task Scheduler, every 15 minutes:

```powershell
schtasks /Create /TN "DocXtract Folder Watcher" /SC MINUTE /MO 15 `
    /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\docxtract\folder-watcher.ps1"
```

macOS/Linux cron, every 15 minutes:

```sh
*/15 * * * * cd /opt/docxtract && /usr/bin/python3 folder_watcher.py >> watcher.log 2>&1
```

Scheduled runs need the key already saved; they never prompt.

## Notes

- Max file size 10 MB per document (API limit). Credits are charged per page.
- Rate limit is 10 requests per minute per key by default. The watcher is sequential, so a
  large backlog processes at roughly that pace; failures from throttling land in `failed/` and
  can be moved back to `invoices/` for the next run.
- Processing is idempotent per file: a file is only moved to `done/` after its data is safely
  captured for the workbook, and one failure never blocks the rest of the batch.
- To extract a different document type, set `document_type` (and optionally `model`). The
  Excel layout assumes an invoice-shaped result with a `line_items` array; other types still
  produce the flattened `Invoices` sheet.

## Licence

MIT, as for the rest of this repository.
