param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ScriptArgs
)

$projectRoot = Split-Path $PSScriptRoot -Parent
$scriptPath = ".\\scripts\\build-dados-complementares-json.mjs"

Push-Location $projectRoot

try {
  node $scriptPath @ScriptArgs
} finally {
  Pop-Location
}
