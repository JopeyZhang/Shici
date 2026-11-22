param(
  [switch]$SkipData,
  [switch]$SkipIcons
)
# Build the signed APK with aapt2 -> javac -> d8 -> zipalign -> apksigner.
# Reuses the Android SDK build-tools already downloaded for jetwar-android.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path (Split-Path -Parent $root) 'jetwar-android\tools\sdk' }
$bt = Join-Path $sdk 'build-tools\34.0.0'
$jar = Join-Path $sdk 'platforms\android-34\android.jar'
$jdk = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { 'E:\Program Files\JetBrains\PyCharm Community Edition 2022.3.2\jbr' }

$env:JAVA_HOME = $jdk
$env:PATH = (Join-Path $jdk 'bin') + ';' + $env:PATH

$build = Join-Path $root 'build'
$outDir = Join-Path $root 'out'
$cnApk = Join-Path $outDir ([string]([char]0x62FE) + [string]([char]0x8BCD) + '-1.0.apk')
$apk = $cnApk

function Step($name) { Write-Host ("`n=== " + $name + " ===") -ForegroundColor Cyan }
function Check($code, $what) { if ($code -ne 0) { throw ($what + ' failed (exit ' + $code + ')') } }

foreach ($p in @((Join-Path $bt 'aapt2.exe'), (Join-Path $bt 'd8.bat'), (Join-Path $bt 'zipalign.exe'), (Join-Path $bt 'apksigner.bat'), $jar, (Join-Path $jdk 'bin\javac.exe'))) {
  if (-not (Test-Path $p)) { throw ("missing tool: " + $p) }
}

Remove-Item -Recurse -Force $build -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $build, (Join-Path $build 'gen'), (Join-Path $build 'classes'), (Join-Path $build 'dex'), $outDir | Out-Null

Step '0/7 prepare data'
if (-not $SkipData) {
  & node (Join-Path $root 'tools\prepare_data.mjs')
  Check $LASTEXITCODE 'prepare_data'
} else {
  Write-Host '  skipped'
}
$media = Get-ChildItem (Join-Path $root 'web\assets\words') -Filter *.webp -File -ErrorAction SilentlyContinue
$mediaCount = if ($media) { $media.Count } else { 0 }
$mediaMb = if ($media) { [math]::Round((($media | Measure-Object Length -Sum).Sum) / 1MB, 1) } else { 0 }
Write-Host ("  illustrations: " + $mediaCount + " files, " + $mediaMb + " MB")
if ($mediaCount -lt 7000) { Write-Warning 'only a few illustrations present; run tools/fetch_media.mjs for the full set' }

Step '1/7 icon'
if (-not $SkipIcons) {
  & python (Join-Path $root 'tools\make_icon.py')
  Check $LASTEXITCODE 'make_icon'
} else {
  Write-Host '  skipped'
}

Step '2/7 aapt2 compile'
& (Join-Path $bt 'aapt2.exe') compile --dir (Join-Path $root 'android\res') -o (Join-Path $build 'res.zip')
Check $LASTEXITCODE 'aapt2 compile'

Step '3/7 aapt2 link (pack web assets)'
& (Join-Path $bt 'aapt2.exe') link -o (Join-Path $build 'base.apk') -I $jar `
  --manifest (Join-Path $root 'android\AndroidManifest.xml') `
  -A (Join-Path $root 'web') `
  --java (Join-Path $build 'gen') --min-sdk-version 23 --target-sdk-version 34 `
  (Join-Path $build 'res.zip')
Check $LASTEXITCODE 'aapt2 link'

Step '4/7 javac'
$javaFiles = @(Get-ChildItem -Recurse -Path (Join-Path $root 'android\src') -Filter *.java | ForEach-Object { $_.FullName })
$rJava = @(Get-ChildItem -Recurse -Path (Join-Path $build 'gen') -Filter R.java | ForEach-Object { $_.FullName })
Write-Host ("  java: " + $javaFiles.Count + ", R.java: " + $rJava.Count)
& (Join-Path $jdk 'bin\javac.exe') -encoding UTF-8 -source 8 -target 8 -nowarn `
  -classpath $jar -d (Join-Path $build 'classes') ($rJava + $javaFiles)
Check $LASTEXITCODE 'javac'

Step '5/7 d8'
$classes = @(Get-ChildItem -Recurse -Path (Join-Path $build 'classes') -Filter *.class | ForEach-Object { $_.FullName })
Write-Host ("  class files: " + $classes.Count)
& (Join-Path $bt 'd8.bat') --lib $jar --min-api 23 --output (Join-Path $build 'dex') $classes
Check $LASTEXITCODE 'd8'
if (-not (Test-Path (Join-Path $build 'dex\classes.dex'))) { throw 'd8 produced no classes.dex' }

Step '6/7 merge dex + zipalign'
& python (Join-Path $root 'tools\add_dex.py') (Join-Path $build 'base.apk') (Join-Path $build 'dex\classes.dex') (Join-Path $build 'unsigned.apk')
Check $LASTEXITCODE 'add_dex'
& (Join-Path $bt 'zipalign.exe') -f -p 4 (Join-Path $build 'unsigned.apk') (Join-Path $build 'aligned.apk')
Check $LASTEXITCODE 'zipalign'

Step '7/7 sign'
$ks = Join-Path $root 'tools\shici.keystore'
$ksPass = $env:SHICI_KS_PASS
if (-not $ksPass) {
  $secure = Read-Host 'Keystore password (set $env:SHICI_KS_PASS to skip this prompt)' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $ksPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if (-not $ksPass) { throw 'A keystore password is required (env SHICI_KS_PASS).' }
if (-not (Test-Path $ks)) {
  & (Join-Path $jdk 'bin\keytool.exe') -genkeypair -keystore $ks -alias shici -keyalg RSA -keysize 2048 `
    -validity 10000 -storepass $ksPass -keypass $ksPass `
    -dname "CN=ShiCi, OU=Study, O=RLOVER, C=CN" -noprompt
  Check $LASTEXITCODE 'keytool'
  Write-Host '  generated tools/shici.keystore (keep it private, never commit)'
}
& (Join-Path $bt 'apksigner.bat') sign --ks $ks --ks-pass "pass:$ksPass" --key-pass "pass:$ksPass" `
  --v1-signing-enabled true --v2-signing-enabled true `
  --out $apk (Join-Path $build 'aligned.apk')
Check $LASTEXITCODE 'apksigner sign'

$size = [math]::Round((Get-Item $apk).Length / 1MB, 1)
Write-Host ("`nAPK ready: " + $cnApk + " (" + $size + " MB)") -ForegroundColor Green

exit 0

