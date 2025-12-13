# PowerShell script to run the server with .env variables

$envFile = ".env"

if (Test-Path $envFile) {
    Write-Host "Loading environment variables from $envFile..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $key, $value = $line -split "=", 2
            if ($key -and $value) {
                [System.Environment]::SetEnvironmentVariable($key, $value, [System.EnvironmentVariableTarget]::Process)
            }
        }
    }
} else {
    Write-Warning ".env file not found!"
}

Write-Host "Starting Go server..." -ForegroundColor Green
go run main.go
