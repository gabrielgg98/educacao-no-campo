param(
  [string]$HtmlPath = ".\docs\documentacao-completa-projeto.html",
  [string]$OutputPdf = ".\output\pdf\documentacao-completa-projeto.pdf",
  [string]$PreviewPng = ".\output\pdf\documentacao-completa-projeto-preview.png",
  [string]$UserDataDir = ".\tmp\chrome-doc-export"
)

$ErrorActionPreference = "Stop"

function Resolve-ChromePath {
  $candidates = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw "Não foi possível localizar Chrome ou Edge para exportar o PDF."
}

function Wait-ForFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [int]$Attempts = 20,
    [int]$DelayMilliseconds = 250
  )

  for ($attempt = 0; $attempt -lt $Attempts; $attempt++) {
    if (Test-Path -LiteralPath $Path) {
      return $true
    }

    Start-Sleep -Milliseconds $DelayMilliseconds
  }

  return $false
}

$resolvedHtml = (Resolve-Path -LiteralPath $HtmlPath).Path
$resolvedOutputPdf = [System.IO.Path]::GetFullPath($OutputPdf)
$resolvedPreviewPng = [System.IO.Path]::GetFullPath($PreviewPng)
$resolvedUserDataDir = [System.IO.Path]::GetFullPath($UserDataDir)
$outputDirectory = Split-Path -Parent $resolvedOutputPdf
$previewDirectory = Split-Path -Parent $resolvedPreviewPng

New-Item -ItemType Directory -Force $outputDirectory, $previewDirectory, $resolvedUserDataDir | Out-Null

$chromePath = Resolve-ChromePath
$htmlUri = ([System.Uri]$resolvedHtml).AbsoluteUri

if (Test-Path -LiteralPath $resolvedOutputPdf) {
  Remove-Item -LiteralPath $resolvedOutputPdf -Force
}

if (Test-Path -LiteralPath $resolvedPreviewPng) {
  Remove-Item -LiteralPath $resolvedPreviewPng -Force
}

& $chromePath `
  --headless=new `
  --disable-gpu `
  --disable-crash-reporter `
  --allow-file-access-from-files `
  "--user-data-dir=$resolvedUserDataDir" `
  --virtual-time-budget=5000 `
  --print-to-pdf-no-header `
  "--print-to-pdf=$resolvedOutputPdf" `
  $htmlUri

if (-not (Wait-ForFile -Path $resolvedOutputPdf)) {
  throw "O PDF não foi gerado."
}

& $chromePath `
  --headless=new `
  --disable-gpu `
  --disable-crash-reporter `
  --allow-file-access-from-files `
  "--user-data-dir=$resolvedUserDataDir" `
  --virtual-time-budget=5000 `
  "--screenshot=$resolvedPreviewPng" `
  --window-size=1440,2200 `
  $htmlUri

Write-Output "PDF gerado em: $resolvedOutputPdf"
Write-Output "Prévia gerada em: $resolvedPreviewPng"
