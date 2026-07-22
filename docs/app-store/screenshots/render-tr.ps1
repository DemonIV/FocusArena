# StudySquad TR store screens — HTML -> PNG (1080x2340 @3x)
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$src = "C:\Users\alper\Desktop\FocusArena\docs\app-store\screenshots\screens-tr"
$out = Join-Path $src "out"
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem "$src\*.html" | ForEach-Object {
  $png = Join-Path $out ($_.BaseName + ".png")
  & $chrome --headless=new --disable-gpu --hide-scrollbars `
    --window-size=360,780 --force-device-scale-factor=3 `
    --screenshot="$png" $_.FullName 2>$null | Out-Null
  Write-Host "rendered $($_.BaseName)"
}
