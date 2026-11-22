param(
  [string[]]$Routes = @('today', 'atlas', 'atlas/topic/education', 'study', 'review', 'practice', 'practice/zh2en', 'me', 'word/library', 'word/strong')
)
# Headless Edge screenshots (390x844 phone frame) + DOM dumps for offline UI checks.
$ErrorActionPreference = 'Stop'
if ($Routes.Count -eq 1 -and $Routes[0] -like '*,*') { $Routes = $Routes[0].Split(',') }

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$web = Join-Path $root 'web'
$prev = Join-Path $root 'out\preview'
$profileDir = Join-Path $root 'out\edge-profile'
New-Item -ItemType Directory -Force -Path $prev, $profileDir | Out-Null

$frame = 'file:///' + ((Join-Path $root 'tools\preview-frame.html') -replace '\\', '/')
$appBase = 'file:///' + ($web -replace '\\', '/') + '/index.html'

foreach ($route in $Routes) {
  $name = $route -replace '/', '-'
  $png = Join-Path $prev ($name + '.png')
  $dom = Join-Path $prev ('dom-' + $name + '.html')
  $err = Join-Path $prev ('dom-' + $name + '.err.txt')
  Remove-Item $png, $dom -ErrorAction SilentlyContinue
  $shotUrl = $frame + '?r=' + $route
  $domUrl = $appBase + '#/' + $route
  cmd /c "`"$edge`" --headless=new --disable-gpu --no-sandbox --no-first-run --hide-scrollbars --user-data-dir=`"$profileDir`" --window-size=492,900 --virtual-time-budget=8000 --screenshot=`"$png`" `"$shotUrl`" 2> `"$err`""
  cmd /c "`"$edge`" --headless=new --disable-gpu --no-sandbox --no-first-run --hide-scrollbars --user-data-dir=`"$profileDir`" --window-size=492,900 --virtual-time-budget=8000 --dump-dom `"$domUrl`" > `"$dom`" 2> `"$err`""
  $pngOk = (Test-Path $png) -and ((Get-Item $png).Length -gt 5000)
  $domOk = (Test-Path $dom) -and ((Get-Item $dom).Length -gt 2000)
  Write-Host ('[{0}] png={1} dom={2}' -f $route, $pngOk, $domOk)
}
Write-Host ('preview -> ' + $prev)
