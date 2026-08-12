# IAP review screenshots — HTML -> PNG, 1170x2532 (iPhone 14: 390x844 @3x).
# Rendered in a deliberately oversized window and cropped to the .phone frame:
# --window-size alone came out viewport-dependent on this host (display scaling),
# which silently clipped the right edge of the sheet.
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$src = "C:\Users\alper\Desktop\FocusArena\docs\app-store\screenshots\iap-review"
$out = Join-Path $src "out"
$raw = Join-Path $src "raw"
New-Item -ItemType Directory -Force $out | Out-Null
New-Item -ItemType Directory -Force $raw | Out-Null

Get-ChildItem "$src\*.html" | ForEach-Object {
  $png = Join-Path $raw ($_.BaseName + ".png")
  & $chrome --headless=new --disable-gpu --hide-scrollbars `
    --window-size=1000,1000 --force-device-scale-factor=3 `
    --screenshot="$png" $_.FullName 2>$null | Out-Null
  Write-Host "rendered $($_.BaseName)"
}

# Crop the top-left phone frame out of each raw shot.
node "$src\crop.js"
