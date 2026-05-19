# Batch English localization - common string replacements only
$tools = @('char-counter','speech-timer','emoji-mixer','zodiac-calc','prompt-gen','utm-builder','pet-age-calc','pet-food-calc','pet-bmi-calc')
$basePath = "C:\Users\Seonkyu\special-chars\en"

foreach ($tool in $tools) {
    $file = Join-Path $basePath "$tool\index.html"
    $content = Get-Content $file -Raw -Encoding UTF8
    
    $content = $content.Replace('lang="ko"', 'lang="en"')
    $content = $content.Replace("orioncactus/pretendard/dist/web/static/pretendard.css", "fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap")
    $content = $content.Replace("'Pretendard'", "'Inter'")
    $content = $content.Replace('"Pretendard"', '"Inter"')
    $content = $content.Replace('aria-label="맨 위로"', 'aria-label="Top"')
    $content = $content.Replace("toLocaleString('ko-KR')", "toLocaleString('en-US')")
    
    # Fix og:url and canonical to en/ path
    $content = $content.Replace(
        "teemozipsa.github.io/special-chars/$tool/",
        "teemozipsa.github.io/special-chars/en/$tool/"
    )
    
    Set-Content $file $content -Encoding UTF8 -NoNewline
    Write-Host "Done: $tool"
}
