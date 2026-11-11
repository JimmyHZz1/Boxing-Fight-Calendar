# Creates the branded Windows application icon before the WPF publish.
Add-Type -AssemblyName System.Drawing
$size = 256
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(21, 21, 21))
$gold = [System.Drawing.Color]::FromArgb(214, 173, 85)
$white = [System.Drawing.Color]::FromArgb(245, 245, 245)
$dark = [System.Drawing.Color]::FromArgb(25, 25, 25)
$goldBrush = New-Object System.Drawing.SolidBrush($gold)
$whiteBrush = New-Object System.Drawing.SolidBrush($white)
$darkBrush = New-Object System.Drawing.SolidBrush($dark)
$pen = New-Object System.Drawing.Pen($gold, 16)
$graphics.DrawRoundedRectangle = $null
$graphics.FillRectangle($goldBrush, 20, 20, 216, 216)
$graphics.FillRectangle($darkBrush, 38, 38, 180, 180)
$graphics.FillRectangle($goldBrush, 55, 82, 146, 17)
foreach ($x in @(66, 111, 156)) {
  foreach ($y in @(120, 164)) {
    $graphics.FillRectangle($whiteBrush, $x, $y, 25, 25)
  }
}
$graphics.FillEllipse($goldBrush, 145, 145, 62, 62)
$graphics.FillEllipse($darkBrush, 165, 165, 22, 22)
$path = Join-Path $PSScriptRoot "app-icon.ico"
$handle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($handle)
$stream = [System.IO.File]::Create($path)
$icon.Save($stream)
$stream.Dispose()
$icon.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
Write-Host "Created $path"
