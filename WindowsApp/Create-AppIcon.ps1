# Generate the Windows icon from the Sports Calendar header brand mark:
# the same gold square and dark condensed "S" used in the website logo.
Add-Type -AssemblyName System.Drawing

$size = 256
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$gold = [System.Drawing.Color]::FromArgb(226, 180, 91)
$dark = [System.Drawing.Color]::FromArgb(23, 19, 13)
$goldBrush = New-Object System.Drawing.SolidBrush($gold)
$darkBrush = New-Object System.Drawing.SolidBrush($dark)

# Match the square gold brand tile used in the website's top-left calendar logo.
$graphics.Clear($gold)
$font = New-Object System.Drawing.Font("Impact", 184, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

# The slight skew mirrors the CSS brand-mark treatment.
$graphics.TranslateTransform(128, 128)
$graphics.RotateTransform(-5)
$graphics.TranslateTransform(-128, -128)
$graphics.DrawString("S", $font, $darkBrush, (New-Object System.Drawing.RectangleF(12, 0, 232, 256)), $format)
$graphics.ResetTransform()

$path = Join-Path $PSScriptRoot "app-icon.ico"
$handle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($handle)
$stream = [System.IO.File]::Create($path)
try { $icon.Save($stream) }
finally {
  $stream.Dispose()
  $icon.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  $font.Dispose()
  $format.Dispose()
  $darkBrush.Dispose()
  $goldBrush.Dispose()
}
Write-Host "Created branded calendar icon: $path"
