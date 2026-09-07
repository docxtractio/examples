# DocXtract Folder Watcher (PowerShell)
# Date: 2026-09-01 | Update: 2026-09-07 | Author: Alok | File: folder-watcher.ps1
# Purpose: Iterate a local folder of invoices, extract each via the DocXtract API
#          (v3.1 defaults: document_type=invoice, model=default), write results to
#          Excel (one workbook or one per invoice), and move processed files to done/.
#
# Requires: Windows PowerShell 5.1+ and the ImportExcel module (auto-installed on first run).
# Usage:    .\folder-watcher.ps1 -ApiKey "YOUR_KEY"
#           .\folder-watcher.ps1 -ExcelMode separate
#           (or set the DOCXTRACT_API_KEY environment variable and omit -ApiKey)

param(
    [string]$InFolder     = ".\invoices",
    [string]$DoneFolder   = ".\done",
    [string]$FailedFolder = ".\failed",
    [string]$OutFolder    = ".\output",
    [ValidateSet("single", "separate")]
    [string]$ExcelMode    = "single",
    [string]$ApiUrl       = "https://api.docxtract.io/v3.1/documents",
    [string]$ApiKey       = $env:DOCXTRACT_API_KEY,
    [string]$Model        = "",   # blank = API default (prompt template "default")
    [string]$DocumentType = ""    # blank = API default ("invoice")
)

$ErrorActionPreference = "Stop"

# First run: ask for the key and save it as a per-user environment variable
# so future runs (including scheduled ones) pick it up automatically.
if (-not $ApiKey) {
    if (-not [Environment]::UserInteractive) {
        Write-Error "No API key. Pass -ApiKey or set the DOCXTRACT_API_KEY environment variable."
        exit 1
    }
    $ApiKey = (Read-Host "Enter your DocXtract API key").Trim()
    if (-not $ApiKey) { Write-Error "No API key entered."; exit 1 }
    [Environment]::SetEnvironmentVariable("DOCXTRACT_API_KEY", $ApiKey, "User")
    Write-Host "API key saved to the DOCXTRACT_API_KEY user environment variable."
}

# --- Dependencies -----------------------------------------------------------
if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
    Write-Host "Installing ImportExcel module (first run only)..."
    Install-Module ImportExcel -Scope CurrentUser -Force
}
Import-Module ImportExcel

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http

foreach ($dir in @($InFolder, $DoneFolder, $FailedFolder, $OutFolder)) {
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
}

$mimeTypes = @{
    ".pdf" = "application/pdf"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"
    ".png" = "image/png"; ".webp" = "image/webp"
}

# --- Helpers ----------------------------------------------------------------

# Flatten the dynamic "data" JSON: nested objects become dot-notation columns,
# arrays of objects (line_items etc.) become separate item rows.
function ConvertTo-FlatRow {
    param($Object, [string]$Prefix = "")
    $row = [ordered]@{}
    $items = @()
    foreach ($prop in $Object.PSObject.Properties) {
        $key = if ($Prefix) { "$Prefix.$($prop.Name)" } else { $prop.Name }
        $val = $prop.Value
        if ($val -is [System.Management.Automation.PSCustomObject]) {
            $nested = ConvertTo-FlatRow -Object $val -Prefix $key
            foreach ($k in $nested.Row.Keys) { $row[$k] = $nested.Row[$k] }
            $items += $nested.Items
        }
        elseif ($val -is [System.Collections.IEnumerable] -and $val -isnot [string]) {
            $asArray = @($val)
            if ($asArray.Count -gt 0 -and $asArray[0] -is [System.Management.Automation.PSCustomObject]) {
                foreach ($el in $asArray) {
                    $itemRow = [ordered]@{ source_array = $key }
                    $flatItem = ConvertTo-FlatRow -Object $el
                    foreach ($k in $flatItem.Row.Keys) { $itemRow[$k] = $flatItem.Row[$k] }
                    $items += ,$itemRow
                }
            }
            else {
                $row[$key] = ($asArray -join "; ")
            }
        }
        else {
            $row[$key] = $val
        }
    }
    return @{ Row = $row; Items = $items }
}

# Pad rows to a shared column set so every row exports with the same headers.
function Get-UniformRows {
    param([array]$Rows)
    $allKeys = New-Object System.Collections.Generic.List[string]
    foreach ($r in $Rows) {
        foreach ($k in $r.Keys) { if (-not $allKeys.Contains($k)) { $allKeys.Add($k) } }
    }
    $out = @()
    foreach ($r in $Rows) {
        $u = [ordered]@{}
        foreach ($k in $allKeys) { $u[$k] = if ($r.Contains($k)) { $r[$k] } else { $null } }
        $out += ,([PSCustomObject]$u)
    }
    return $out
}

function Invoke-DocXtract {
    param([string]$FilePath)
    $client = [System.Net.Http.HttpClient]::new()
    try {
        $client.Timeout = [TimeSpan]::FromSeconds(180)
        $client.DefaultRequestHeaders.Authorization =
            [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $ApiKey)
        $form = [System.Net.Http.MultipartFormDataContent]::new()
        $stream = [System.IO.File]::OpenRead($FilePath)
        try {
            $fileContent = [System.Net.Http.StreamContent]::new($stream)
            $ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
            $fileContent.Headers.ContentType =
                [System.Net.Http.Headers.MediaTypeHeaderValue]::new($mimeTypes[$ext])
            $form.Add($fileContent, "file", [System.IO.Path]::GetFileName($FilePath))
            # Only send options that are actually set; when none are, the API
            # applies its v3.1 defaults (document_type=invoice, model=default).
            $options = @{}
            if ($Model)        { $options["model"] = $Model }
            if ($DocumentType) { $options["document_type"] = $DocumentType }
            if ($options.Count -gt 0) {
                $form.Add([System.Net.Http.StringContent]::new(($options | ConvertTo-Json -Compress)), "options")
            }
            $response = $client.PostAsync($ApiUrl, $form).GetAwaiter().GetResult()
            $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            return $body | ConvertFrom-Json
        }
        finally { $stream.Dispose() }
    }
    finally { $client.Dispose() }
}

function Move-Unique {
    param([string]$FilePath, [string]$TargetDir)
    $name = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    $ext  = [System.IO.Path]::GetExtension($FilePath)
    $dest = Join-Path $TargetDir ([System.IO.Path]::GetFileName($FilePath))
    if (Test-Path $dest) {
        $dest = Join-Path $TargetDir ("{0}_{1}{2}" -f $name, (Get-Date -Format "yyyyMMdd_HHmmss"), $ext)
    }
    Move-Item -Path $FilePath -Destination $dest
}

function Write-Workbook {
    param([string]$Path, [array]$InvoiceRows, [array]$ItemRows)
    if (Test-Path $Path) { Remove-Item $Path }
    Get-UniformRows $InvoiceRows | Export-Excel -Path $Path -WorksheetName "Invoices" -AutoSize -FreezeTopRow -BoldTopRow
    if ($ItemRows.Count -gt 0) {
        Get-UniformRows $ItemRows | Export-Excel -Path $Path -WorksheetName "LineItems" -AutoSize -FreezeTopRow -BoldTopRow
    }
}

# --- Main loop --------------------------------------------------------------

$files = Get-ChildItem -Path $InFolder -File | Where-Object { $mimeTypes.ContainsKey($_.Extension.ToLower()) }
if ($files.Count -eq 0) {
    Write-Host "No PDF/image files found in $InFolder. Nothing to do."
    exit 0
}

Write-Host "Processing $($files.Count) file(s) from $InFolder (mode: $ExcelMode)..."
$allInvoiceRows = @()
$allItemRows = @()
$ok = 0; $failed = 0

foreach ($file in $files) {
    Write-Host -NoNewline "  $($file.Name) ... "
    try {
        $result = Invoke-DocXtract -FilePath $file.FullName
        if (-not $result.success) {
            throw "API error: $($result.error.message)"
        }
        $flat = ConvertTo-FlatRow -Object $result.data
        $invoiceRow = [ordered]@{
            source_file  = $file.Name
            processed_at = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        }
        foreach ($k in $flat.Row.Keys) { $invoiceRow[$k] = $flat.Row[$k] }
        $itemRows = @()
        foreach ($item in $flat.Items) {
            $ir = [ordered]@{ source_file = $file.Name }
            foreach ($k in $item.Keys) { $ir[$k] = $item[$k] }
            $itemRows += ,$ir
        }

        if ($ExcelMode -eq "separate") {
            $xlsxPath = Join-Path $OutFolder ($file.BaseName + ".xlsx")
            Write-Workbook -Path $xlsxPath -InvoiceRows @($invoiceRow) -ItemRows $itemRows
        }
        else {
            $allInvoiceRows += ,$invoiceRow
            $allItemRows += $itemRows
        }

        Move-Unique -FilePath $file.FullName -TargetDir $DoneFolder
        $ok++
        Write-Host "OK"
    }
    catch {
        $failed++
        Write-Host "FAILED — $($_.Exception.Message)" -ForegroundColor Red
        try { Move-Unique -FilePath $file.FullName -TargetDir $FailedFolder } catch {}
    }
}

if ($ExcelMode -eq "single" -and $allInvoiceRows.Count -gt 0) {
    $xlsxPath = Join-Path $OutFolder "invoices.xlsx"
    # Merge with rows from previous runs so the workbook keeps growing.
    if (Test-Path $xlsxPath) {
        $existing = Import-Excel -Path $xlsxPath -WorksheetName "Invoices" |
            ForEach-Object { $h = [ordered]@{}; $_.PSObject.Properties | ForEach-Object { $h[$_.Name] = $_.Value }; $h }
        $existingItems = @()
        if ((Get-ExcelSheetInfo -Path $xlsxPath | Where-Object Name -eq "LineItems")) {
            $existingItems = Import-Excel -Path $xlsxPath -WorksheetName "LineItems" |
                ForEach-Object { $h = [ordered]@{}; $_.PSObject.Properties | ForEach-Object { $h[$_.Name] = $_.Value }; $h }
        }
        $allInvoiceRows = @($existing) + $allInvoiceRows
        $allItemRows = @($existingItems) + $allItemRows
    }
    Write-Workbook -Path $xlsxPath -InvoiceRows $allInvoiceRows -ItemRows $allItemRows
    Write-Host "Workbook updated: $xlsxPath"
}

Write-Host "Done. $ok succeeded, $failed failed."
