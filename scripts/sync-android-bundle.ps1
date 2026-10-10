param(
  [string]$SourceRoot = (Join-Path $PSScriptRoot "..\\public"),
  [string]$AndroidRoot = (Join-Path $PSScriptRoot "..\\android\\app\\src\\main\\assets"),
  [string]$OverrideRoot = (Join-Path $PSScriptRoot "..\\android\\overrides")
)

$ErrorActionPreference = "Stop"
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$AndroidRoot = (New-Item -ItemType Directory -Force -Path $AndroidRoot).FullName
$OverrideRoot = (Resolve-Path -LiteralPath $OverrideRoot).Path

Get-ChildItem -LiteralPath $AndroidRoot -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $SourceRoot "*") -Destination $AndroidRoot -Recurse -Force

$gamePath = Join-Path $AndroidRoot "game3d.js"
$game = Get-Content -LiteralPath $gamePath -Raw
$game = $game.Replace('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js', './vendor/three.module.js')
Set-Content -LiteralPath $gamePath -Value $game -Encoding utf8

$graphicsPath = Join-Path $AndroidRoot "graphics-config.mjs"
$graphics = Get-Content -LiteralPath $graphicsPath -Raw
$graphics = $graphics.Replace('return typeof value === "string" && value.length > 0 ? value : null;', 'if (typeof value !== "string" || value.length === 0) return null; return value.startsWith("/") ? "." + value : value;')
Set-Content -LiteralPath $graphicsPath -Value $graphics -Encoding utf8

Copy-Item -LiteralPath (Join-Path $OverrideRoot "android-platform.css") -Destination (Join-Path $AndroidRoot "android-platform.css") -Force
Copy-Item -LiteralPath (Join-Path $OverrideRoot "android-platform.js") -Destination (Join-Path $AndroidRoot "android-platform.js") -Force

$indexPath = Join-Path $AndroidRoot "index.html"
$index = Get-Content -LiteralPath $indexPath -Raw
$index = $index.Replace('<link rel="stylesheet" href="style.css" />', '<link rel="stylesheet" href="style.css" /><link rel="stylesheet" href="android-platform.css" />')
$index = $index.Replace('<script type="module" src="game3d.js"></script>', '<script type="module" src="game3d.js"></script><script type="module" src="android-platform.js"></script>')
Set-Content -LiteralPath $indexPath -Value $index -Encoding utf8

Write-Output "Android bundle synchronized from the web source with Android-only overrides."
