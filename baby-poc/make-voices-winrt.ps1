# Fictional narration assets only. Run with Windows PowerShell 5.1.
# No microphone, network, AI service, or production material is involved.
param(
  [string]$NodePath = 'C:\Users\chao_\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
)

$babyRoot = $PSScriptRoot
$babyScratch = Join-Path $babyRoot 'scratch'
$babyAssetDir = Join-Path $babyRoot 'assets'
$babyWebAssetDir = Join-Path $babyRoot 'web\assets'
New-Item -ItemType Directory -Force -Path $babyScratch,$babyAssetDir,$babyWebAssetDir | Out-Null

$babyExport = @'
import { fixtures } from './fixtures.mjs';
import { writeFileSync } from 'node:fs';
writeFileSync('./scratch/voice-source.json', JSON.stringify({zh:fixtures('zh').moments.map(m=>m.note),en:fixtures('en').moments.map(m=>m.note)},null,2), 'utf8');
'@
Push-Location $babyRoot
& $NodePath --input-type=module -e $babyExport
Pop-Location
$babySources = Get-Content -LiteralPath (Join-Path $babyScratch 'voice-source.json') -Raw -Encoding UTF8 | ConvertFrom-Json

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]
$babyAsTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
$babySpeechTask = $babyAsTask.MakeGenericMethod([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$babyChinese = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()
$babyChinese.Voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -eq 'zh-TW' -and $_.DisplayName -like '*Hanhan*' } | Select-Object -First 1

for ($babyIndex = 0; $babyIndex -lt 3; $babyIndex++) {
  $babyOperation = $babyChinese.SynthesizeTextToStreamAsync([string]$babySources.zh[$babyIndex])
  $babyTask = $babySpeechTask.Invoke($null, @($babyOperation))
  $babyTask.Wait()
  $babySpeech = $babyTask.Result
  $babyInput = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($babySpeech)
  $babyOutputPath = Join-Path $babyAssetDir "voice-zh-$($babyIndex+1).wav"
  $babyOutput = [System.IO.File]::Create($babyOutputPath)
  $babyInput.CopyTo($babyOutput)
  $babyOutput.Dispose()
  $babyInput.Dispose()
  $babySpeech.Dispose()
  Copy-Item -LiteralPath $babyOutputPath -Destination (Join-Path $babyWebAssetDir "voice-zh-$($babyIndex+1).wav") -Force
}
$babyChineseVoice = $babyChinese.Voice.DisplayName
$babyChinese.Dispose()

# The installed Desktop Zira voice is exposed to System.Speech in PowerShell 7.
$env:BABY_NARRATION_ROOT = $babyRoot
$babyEnglishCode = @'
Add-Type -AssemblyName System.Speech
$babyRoot = $env:BABY_NARRATION_ROOT
$babySources = Get-Content -LiteralPath (Join-Path $babyRoot 'scratch/voice-source.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$babyEnglish = New-Object System.Speech.Synthesis.SpeechSynthesizer
$babyEnglish.SelectVoice('Microsoft Zira Desktop')
$babyEnglish.Rate = -1
for ($babyIndex = 0; $babyIndex -lt 3; $babyIndex++) {
  $babyOutputPath = Join-Path $babyRoot "assets/voice-en-$($babyIndex+1).wav"
  $babyEnglish.SetOutputToWaveFile($babyOutputPath)
  $babyEnglish.Speak([string]$babySources.en[$babyIndex])
  $babyEnglish.SetOutputToNull()
  Copy-Item -LiteralPath $babyOutputPath -Destination (Join-Path $babyRoot "web/assets/voice-en-$($babyIndex+1).wav") -Force
}
$babyEnglish.Dispose()
'@
& (Get-Command pwsh).Source -NoProfile -Command $babyEnglishCode

Write-Output "Fictional narration assets created: zh-TW $babyChineseVoice; en-US Microsoft Zira Desktop."
Get-ChildItem -LiteralPath $babyAssetDir -Filter 'voice-*.wav' | Select-Object Name,Length
