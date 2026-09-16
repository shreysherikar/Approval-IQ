$ErrorActionPreference = "Stop"

$adoptiumDirs = Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory -Filter "jdk-21*" -ErrorAction SilentlyContinue
if ($adoptiumDirs -and $adoptiumDirs.Count -gt 0) {
    $javaHome = $adoptiumDirs[0].FullName
} else {
    $javaHome = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
}
$androidHome = "C:\Users\Admin\AppData\Local\Android\Sdk"

if (-not (Test-Path $javaHome)) {
    Write-Error "JAVA_HOME path not found at $javaHome"
    exit 1
}
if (-not (Test-Path $androidHome)) {
    Write-Error "ANDROID_HOME path not found at $androidHome"
    exit 1
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:PATH = "$javaHome\bin;$androidHome\platform-tools;$env:PATH"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$androidDir = Join-Path $projectDir "android"

Write-Output "Environment configured:"
Write-Output "  JAVA_HOME:    $env:JAVA_HOME"
Write-Output "  ANDROID_HOME: $env:ANDROID_HOME"
Write-Output "  Building Android debug APK in $androidDir..."

Push-Location $androidDir
try {
    .\gradlew.bat assembleDebug
} finally {
    Pop-Location
}

$apkPath = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $apkItem = Get-Item $apkPath
    Write-Output "SUCCESS: Android debug APK produced!"
    Write-Output "  Path: $($apkItem.FullName)"
    Write-Output "  Size: $([math]::Round($apkItem.Length / 1MB, 2)) MB ($($apkItem.Length) bytes)"
} else {
    Write-Error "APK file not found at $apkPath"
    exit 1
}
