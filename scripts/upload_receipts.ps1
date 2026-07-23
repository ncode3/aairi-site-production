[CmdletBinding()]
param(
    [string]$EnvFile
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
if (-not $EnvFile) {
    $EnvFile = Join-Path $RootDir "config/azure.env"
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI is not installed. Install it, then rerun this script."
}
if (-not (Test-Path $EnvFile)) {
    throw "Missing $EnvFile. Copy config/azure.env.example to config/azure.env and fill in the storage account."
}

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
}

$ReceiptsDir = if ($env:AVARON_RECEIPTS_DIR) { $env:AVARON_RECEIPTS_DIR } else { Join-Path $RootDir "restricted_inputs/avaron/2026-07-10" }

$StorageAccount = $env:AZURE_STORAGE_ACCOUNT
$Container = $env:AZURE_BLOB_CONTAINER
$Prefix = $env:AZURE_BLOB_PREFIX.TrimEnd("/")

if (-not $StorageAccount -or $StorageAccount -eq "REPLACE_WITH_STORAGE_ACCOUNT") {
    throw "Set AZURE_STORAGE_ACCOUNT in config/azure.env."
}
if (-not $Container) { throw "AZURE_BLOB_CONTAINER is required." }
if (-not $Prefix) { throw "AZURE_BLOB_PREFIX is required." }
if ($Prefix -ne "raw/99_restricted/avaron/2026-07-10") {
    throw "Avaron receipts may only route to raw/99_restricted/avaron/2026-07-10/."
}
if (-not (Test-Path $ReceiptsDir -PathType Container)) { throw "Missing restricted receipt input directory: $ReceiptsDir" }

az account show *> $null
if ($LASTEXITCODE -ne 0) {
    az login
    if ($LASTEXITCODE -ne 0) { throw "Azure login failed." }
}

if ($env:AZURE_SUBSCRIPTION_ID) {
    az account set --subscription $env:AZURE_SUBSCRIPTION_ID
    if ($LASTEXITCODE -ne 0) { throw "Could not select the Azure subscription." }
}

az storage container create `
    --account-name $StorageAccount `
    --name $Container `
    --auth-mode login `
    --public-access off `
    --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not create or access the private container." }

$InvoiceData = @{
    "Invoice-0103.pdf" = @{ Invoice="0103"; Amount="2570.94"; Description="monthly_space_and_energy"; Sha256="05dc182cdd27b4d864ae546dcaf96836921c8745d7e859ca7b8942a689990092" }
    "Invoice-0104.pdf" = @{ Invoice="0104"; Amount="500.00"; Description="installation_fee"; Sha256="95ec90fcf32b9cdb901e1c710305a9a882933df087fc90e65dd48bda6eea1ff4" }
}

Get-ChildItem -Path $ReceiptsDir -Filter "*.pdf" | ForEach-Object {
    $File = $_
    if (-not $InvoiceData.ContainsKey($File.Name)) {
        Write-Host "Skipping unrecognized file: $($File.Name)"
        return
    }

    $Data = $InvoiceData[$File.Name]
    $Sha = (Get-FileHash -Path $File.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Sha -ne $Data.Sha256) { throw "SHA-256 mismatch for $($File.Name); refusing upload." }
    $Blob = "$Prefix/$($File.Name)"

    $Exists = az storage blob exists `
        --account-name $StorageAccount `
        --container-name $Container `
        --name $Blob `
        --auth-mode login `
        --query exists -o tsv
    if ($LASTEXITCODE -ne 0) { throw "Could not check $Blob." }

    if ($Exists.Trim().ToLowerInvariant() -eq "true") {
        Write-Host "SKIP: $Blob already exists."
        return
    }

    Write-Host "UPLOAD: $($File.Name) -> $Blob"
    az storage blob upload `
        --account-name $StorageAccount `
        --container-name $Container `
        --name $Blob `
        --file $File.FullName `
        --auth-mode login `
        --overwrite false `
        --content-type application/pdf `
        --metadata `
            source=avaron `
            vendor=avaron_ai `
            invoice_number=$($Data.Invoice) `
            invoice_date=2026-07-10 `
            amount_usd=$($Data.Amount) `
            description=$($Data.Description) `
            original_filename=$($File.Name) `
            sha256=$Sha `
            category=financial_records `
            document_type=invoice `
            payment_status=paid `
            sensitivity=restricted `
            index_allowed=false `
        --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Upload failed for $($File.Name)." }

    Write-Host "DONE: $Blob"
}

Write-Host ""
Write-Host "Verification:"
az storage blob list `
    --account-name $StorageAccount `
    --container-name $Container `
    --prefix "$Prefix/" `
    --auth-mode login `
    --query "[].{Blob:name,Size:properties.contentLength,Type:properties.contentSettings.contentType}" `
    -o table
if ($LASTEXITCODE -ne 0) { throw "Verification failed." }
