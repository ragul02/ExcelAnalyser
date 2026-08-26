# Excel Analyser - Store Readiness Check
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Excel Analyser - Store Readiness Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check 1: package.json
Write-Host "[1/6] Checking package.json..." -NoNewline
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    Write-Host ""
    Write-Host "    Version: $($pkg.version)" -ForegroundColor Green
    Write-Host "    Description: $($pkg.description)" -ForegroundColor Green
    Write-Host "    Author: $($pkg.author)" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    $allGood = $false
}

# Check 2: APPX configuration
Write-Host "[2/6] Checking APPX configuration..." -NoNewline
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($pkg.build.appx) {
        $appx = $pkg.build.appx
        Write-Host ""
        if ($appx.identityName -eq "Southernstoreapps.DataAnalyzer") {
            Write-Host "    WARNING: Using placeholder identity!" -ForegroundColor Yellow
            Write-Host "    Update from Partner Center" -ForegroundColor Yellow
            $allGood = $false
        } else {
            Write-Host "    Identity: $($appx.identityName)" -ForegroundColor Green
        }
        Write-Host "    Publisher: $($appx.publisher)" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        $allGood = $false
    }
}

# Check 3: Build outputs
Write-Host "[3/6] Checking build outputs..." -NoNewline
if (Test-Path "dist-electron") {
    $appxFiles = Get-ChildItem "dist-electron\*.appx" -ErrorAction SilentlyContinue
    Write-Host ""
    if ($appxFiles) {
        Write-Host "    APPX: $($appxFiles[0].Name)" -ForegroundColor Green
    } else {
        Write-Host "    No APPX found" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host " FAILED" -ForegroundColor Red
    $allGood = $false
}

# Check 4: Angular build
Write-Host "[4/6] Checking Angular build..." -NoNewline
if (Test-Path "dist\DataAnalyzer\browser\index.html") {
    $indexHtml = Get-Content "dist\DataAnalyzer\browser\index.html" -Raw
    Write-Host ""
    if ($indexHtml -match 'base href="\.\/"') {
        Write-Host "    Base href: relative (./) OK" -ForegroundColor Green
    } else {
        Write-Host "    Base href: may cause issues" -ForegroundColor Yellow
    }
} else {
    Write-Host " Not found" -ForegroundColor Yellow
}

# Check 5: Icons
Write-Host "[5/6] Checking icon files..." -NoNewline
if ((Test-Path "src\assets\icon\icon.ico") -and (Test-Path "src\assets\icon\icon.png")) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " Missing" -ForegroundColor Red
    $allGood = $false
}

# Check 6: Electron files
Write-Host "[6/6] Checking Electron files..." -NoNewline
if ((Test-Path "main.js") -and (Test-Path "preload.js")) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " Missing" -ForegroundColor Red
    $allGood = $false
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Register at partner.microsoft.com" -ForegroundColor White
    Write-Host "2. Get app identity from Partner Center" -ForegroundColor White
    Write-Host "3. Update package.json" -ForegroundColor White
    Write-Host "4. Rebuild: npm run electron:build:win" -ForegroundColor White
} else {
    Write-Host "ISSUES FOUND - Fix and rebuild" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
