# Script to generate AppX and installer assets from the app icon
# Mirrors the same workflow used by the GenAI Chat project

Add-Type -AssemblyName System.Drawing

$sourcePath = "src\assets\icon\icon.png"
if (-not (Test-Path $sourcePath)) {
    $sourcePath = "src\assets\icon\favicon.png"
}

$destDir = "src\assets\appx"

Write-Host "Generating AppX assets..." -ForegroundColor Cyan
Write-Host "Source: $sourcePath"
Write-Host "Destination: $destDir"

if (-not (Test-Path $sourcePath)) {
    Write-Error "Source image not found at src\assets\icon\icon.png or src\assets\icon\favicon.png"
    exit 1
}

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    Write-Host "Created directory: $destDir" -ForegroundColor Green
}

$sizes = @{
    "Square44x44Logo.png" = @{W=44; H=44}
    "Square150x150Logo.png" = @{W=150; H=150}
    "Wide310x150Logo.png" = @{W=310; H=150}
    "Square310x310Logo.png" = @{W=310; H=310}
    "StoreLogo.png" = @{W=50; H=50}
}

try {
    $srcImage = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))
} catch {
    Write-Error "Failed to load source image. Error: $_"
    exit 1
}

try {
    Write-Host "Checking icon.ico..." -ForegroundColor Cyan
    $icoPath = Join-Path "src\assets\icon" "icon.ico"

    if (Test-Path $icoPath) {
        Write-Host "Existing icon.ico found. Keeping the current file to avoid overwriting your custom icon." -ForegroundColor Yellow
    } else {
        $iconSize = 256
        $iconBmp = New-Object System.Drawing.Bitmap $iconSize, $iconSize
        $g = [System.Drawing.Graphics]::FromImage($iconBmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)

        $ratioX = $iconSize / $srcImage.Width
        $ratioY = $iconSize / $srcImage.Height
        $ratio = [Math]::Min($ratioX, $ratioY)
        $newW = [int]($srcImage.Width * $ratio)
        $newH = [int]($srcImage.Height * $ratio)
        $posX = [int](($iconSize - $newW) / 2)
        $posY = [int](($iconSize - $newH) / 2)

        $g.DrawImage($srcImage, $posX, $posY, $newW, $newH)

        $iconHandle = $iconBmp.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($iconHandle)

        $fs = New-Object System.IO.FileStream $icoPath, "Create"
        $icon.Save($fs)
        $fs.Close()

        $icon.Dispose()
        $g.Dispose()
        $iconBmp.Dispose()

        Write-Host "Generated: icon.ico (256x256)" -ForegroundColor Green
    }
} catch {
    Write-Error "Failed to generate icon.ico. Error: $_"
}

foreach ($name in $sizes.Keys) {
    try {
        $size = $sizes[$name]
        $destPath = Join-Path $destDir $name

        $bmp = New-Object System.Drawing.Bitmap $size.W, $size.H
        $graph = [System.Drawing.Graphics]::FromImage($bmp)

        $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graph.Clear([System.Drawing.Color]::Transparent)

        $ratioX = $size.W / $srcImage.Width
        $ratioY = $size.H / $srcImage.Height
        $ratio = [Math]::Min($ratioX, $ratioY)

        $newW = [int]($srcImage.Width * $ratio)
        $newH = [int]($srcImage.Height * $ratio)
        $posX = [int](($size.W - $newW) / 2)
        $posY = [int](($size.H - $newH) / 2)

        $graph.DrawImage($srcImage, $posX, $posY, $newW, $newH)
        $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

        Write-Host "Generated: $name ($($size.W)x$($size.H))" -ForegroundColor Green
    } catch {
        Write-Error "Failed to generate $name. Error: $_"
    } finally {
        if ($graph) { $graph.Dispose() }
        if ($bmp) { $bmp.Dispose() }
    }
}

if ($srcImage) { $srcImage.Dispose() }
Write-Host "Asset generation complete." -ForegroundColor Cyan
