Add-Type -AssemblyName System.Speech
$babyVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$babyVoice.SelectVoice('Microsoft Zira Desktop')
$babyVoice.Rate = -1
$babyAssetDir = Join-Path $PSScriptRoot 'assets'
New-Item -ItemType Directory -Force -Path $babyAssetDir | Out-Null
$babyLines = @(
  'This is a synthetic narration for a fictional family sample. We sat by the window and watched the morning light together.',
  'This is a synthetic narration for a fictional family sample. At Grandma''s house, you held the table and stood for a little while.',
  'This is a synthetic narration for a fictional family sample. We went to the park. You watched the leaves moving above the stroller.'
)
foreach ($babyLang in @('zh', 'en')) {
  for ($babyIndex = 0; $babyIndex -lt 3; $babyIndex++) {
    $babyVoice.SetOutputToWaveFile((Join-Path $babyAssetDir "voice-$babyLang-$($babyIndex+1).wav"))
    $babyVoice.Speak($babyLines[$babyIndex])
    $babyVoice.SetOutputToNull()
  }
}
$babyVoice.Dispose()
