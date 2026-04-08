param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ScriptArgs
)

$projectRoot = Split-Path $PSScriptRoot -Parent
$syncScript = Join-Path $PSScriptRoot "run-school-enrichment-sync.ps1"
$bundleScript = Join-Path $PSScriptRoot "run-school-enrichment-bundle.ps1"
$complementaryDataScript = Join-Path $PSScriptRoot "run-dados-complementares-build.ps1"

Push-Location $projectRoot

try {
  powershell -ExecutionPolicy Bypass -File $syncScript @ScriptArgs

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  powershell -ExecutionPolicy Bypass -File $bundleScript

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  powershell -ExecutionPolicy Bypass -File $complementaryDataScript
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
