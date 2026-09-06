<!--
Date: 2026-09-06
Author: Alok
File: resume-desk/README.md
Purpose: Setup, workflow and implementation guide.
-->
# Resume Screening Desk · Python

Drop CVs + a job description → extract structured candidate profiles → review criteria → compare skills/experience → rank and export.

Read the [documentation article](https://docs.docxtract.io/examples/resume-screening-python).

## Install and run

Requires Python 3.10+.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

Open [Resume Desk](http://127.0.0.1:3102). After installation, use `./start.sh`. Override the port with `PORT=3202 .venv/bin/python app.py`.

## What to demonstrate

The sample workspace contains a synthetic JD and three candidates. With Python, SQL and REST APIs required, 3 years of minimum experience and an 80% skill weight, Alex scores 100, Sam scores 66.67 and Jordan remains unranked because experience is unknown. Increase minimum experience to 6 years: Alex scores 96.67 and Sam scores 60. Every row explains matched and missing skills; Review shows the component scores and source facts.

CV model and document type both default to `resume`. The JD model and type also start at `resume` to honor the requested defaults; select a suitable account-enabled template if your JD extraction needs a different schema. All four options are configurable. A resume-oriented template may not infer JD requirements, so always review the criteria before ranking.

## Job description input

- Upload a PDF, PNG or JPG: the Python SDK extracts it using the JD settings. Recognized `required_skills`/`skills` and `minimum_experience_years`/`min_years` populate editable criteria.
- Upload a `.txt` file, or paste the JD directly: this stays local and requires no key. For automatic TXT prefill, use labeled lines:

```text
Required skills: Python, SQL, REST APIs
Minimum experience: 3 years
```

- Ordinary freeform JD text is preserved; explicitly enter its required skills and minimum years. The app does not invent a skills list from prose.
- PDF/image JD extraction is retained in the JSON export. Editing the JD text records that the current criteria are based on manually supplied/reviewed text. A partial extracted JD must be replaced or manually reviewed before ranking.

## Ranking rules

`score = skill coverage × skill weight + experience coverage × (1 − skill weight)`

- Skill coverage is the proportion of distinct required skills found in structured candidate skills, normalized for case and whitespace. Matching is exact: Java does not match JavaScript. No inferred synonyms or protected/personal fields affect scoring.
- Experience coverage is `min(candidate years / required years, 1)`. With zero minimum years, coverage is 100%.
- Skill weight ranges from 0 to 100%; minimum years from 0 to 80. Empty or invalid criteria are rejected.
- Explicit reported experience is preferred. If absent, complete ISO `YYYY-MM-DD` role dates are merged to avoid double-counting overlapping employment. `present`, `current` and `now` use the local current date. Missing or ambiguous dates stay unknown.
- Missing structured skills, unknown experience where a minimum is required, or partial CV extraction keep a candidate unranked. Review/correct the evidence rather than treating unknown data as a zero.
- Equal scores have the same rank. Criteria changes and corrections invalidate the prior ranking.
- Scores are a review aid. The app does not accept/reject candidates or contact anyone.

## Field mapping

Normalized keys: `name`, `skills`, `years`, `experience`. Defaults include `name|full_name|candidate.name|personal_details.name`, `skills|technical_skills|core_skills`, `years_of_experience|total_experience_years|total_years_experience`, and `work_experience|experience|employment_history`.

```json
{"name":"Candidate.Name","skills":"Candidate.TechnicalSkills","years":"Candidate.TotalYears","experience":"Candidate.Roles"}
```

Skills may be comma-separated text, lists, or category objects containing skill lists. Work roles may include `start_date`/`end_date` or `from`/`to`.

## Code and tests

- `app.py`: Flask routes `/api/connect`, `/api/extract`, `/api/analyse`, `/api/rank`; imports `DocXtract` from the installed `docxtract-sdk` distribution.
- `includes/screening.py`: profile normalization, merged experience intervals and explainable ranking.
- `includes/*.php`: HTML-only view fragments assembled by Python. PHP is not required.

```sh
.venv/bin/python -m unittest discover -s tests -v
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
