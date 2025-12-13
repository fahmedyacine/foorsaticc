# PowerShell script to set environment variables

Write-Host "Setting environment variables..." -ForegroundColor Green

# Set for current session
$env:MISTRAL_API_KEY = "97ZQlsV45YrDusgZRwjArWGbh3nerFPb"
$env:DEEPSEEK_API_KEY = "9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q"

# Set permanently for user
[System.Environment]::SetEnvironmentVariable("MISTRAL_API_KEY", "97ZQlsV45YrDusgZRwjArWGbh3nerFPb", [System.EnvironmentVariableTarget]::User)
[System.Environment]::SetEnvironmentVariable("DEEPSEEK_API_KEY", "9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q", [System.EnvironmentVariableTarget]::User)

Write-Host ""
Write-Host "Environment variables set successfully!" -ForegroundColor Green
Write-Host "MISTRAL_API_KEY: Set" -ForegroundColor Yellow
Write-Host "DEEPSEEK_API_KEY: Set" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: You may need to restart your terminal/IDE for permanent changes to take effect." -ForegroundColor Cyan
Write-Host "The variables are available in the current PowerShell session immediately." -ForegroundColor Cyan

