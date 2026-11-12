# Build a multi-resolution Windows ICO so Explorer, the taskbar, window chrome,
# shortcuts and the notification area can select an appropriate icon size.
Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$gold = [System.Drawing.Color]::FromArgb(226, 180, 91)
$dark = [System.Drawing.Color]::FromArgb(23, 19, 13)
$frames = [System.Collections.Generic.List[byte[]]]::new()

foreach ($size in $sizes) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear($gold)
    $fontSize = [Math]::Max(10, [int]($size * 0.73))
    $font = [System.Drawing.Font]::new("Impact", [single]$fontSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = [System.Drawing.SolidBrush]::new($dark)
    $format = [System.Drawing.StringFormat]::new()
    try {
      $format.Alignment = [System.Drawing.StringAlignment]::Center
      $format.LineAlignment = [System.Drawing.StringAlignment]::Center
      $graphics.TranslateTransform($size / 2, $size / 2)
      $graphics.RotateTransform(-5)
      $graphics.TranslateTransform(-$size / 2, -$size / 2)
      $graphics.DrawString("H", $font, $brush, [System.Drawing.RectangleF]::new(0, 0, $size, $size), $format)
    } finally {
      $format.Dispose()
      $brush.Dispose()
      $font.Dispose()
    }
    $stream = [System.IO.MemoryStream]::new()
    try {
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      $frames.Add($stream.ToArray())
    } finally { $stream.Dispose() }
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

# ICO directory followed by PNG-encoded image frames (supported by modern Windows).
$path = Join-Path $PSScriptRoot "app-icon.ico"
$directoryLength = 6 + (16 * $frames.Count)
$file = [System.IO.File]::Create($path)
$writer = [System.IO.BinaryWriter]::new($file)
try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$frames.Count)
  $offset = $directoryLength
  for ($i = 0; $i -lt $frames.Count; $i++) {
    $size = $sizes[$i]
    $bytes = $frames[$i]
    $dimension = if ($size -eq 256) { [byte]0 } else { [byte]$size }
    $writer.Write($dimension)
    $writer.Write($dimension)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $bytes.Length
  }
  foreach ($bytes in $frames) { $writer.Write($bytes) }
} finally {
  $writer.Dispose()
  $file.Dispose()
}
Write-Host "Created multi-resolution The Hub icon ($($sizes -join ', ') px): $path"
