# Build a simple, unmistakable H app icon at all common Windows icon sizes.
# The mark is drawn from three clean rectangles rather than stylised typography.
Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$gold = [System.Drawing.Color]::FromArgb(226, 180, 91)
$dark = [System.Drawing.Color]::FromArgb(23, 19, 13)
$frames = [System.Collections.Generic.List[byte[]]]::new()

foreach ($size in $sizes) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.Clear($gold)
    $margin = [single]($size * 0.22)
    $bar = [single]([Math]::Max(2, $size * 0.18))
    $crossbar = [single]([Math]::Max(2, $size * 0.18))
    $middleY = [single](($size - $crossbar) / 2)
    $brush = [System.Drawing.SolidBrush]::new($dark)
    try {
      $graphics.FillRectangle($brush, $margin, $margin, $bar, $size - (2 * $margin))
      $graphics.FillRectangle($brush, $size - $margin - $bar, $margin, $bar, $size - (2 * $margin))
      $graphics.FillRectangle($brush, $margin, $middleY, $size - (2 * $margin), $crossbar)
    } finally { $brush.Dispose() }
    $stream = [System.IO.MemoryStream]::new()
    try { $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png); $frames.Add($stream.ToArray()) }
    finally { $stream.Dispose() }
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}

# ICO directory followed by PNG-encoded image frames (supported by modern Windows).
$path = Join-Path $PSScriptRoot "app-icon.ico"
$directoryLength = 6 + (16 * $frames.Count)
$file = [System.IO.File]::Create($path)
$writer = [System.IO.BinaryWriter]::new($file)
try {
  $writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]$frames.Count)
  $offset = $directoryLength
  for ($i = 0; $i -lt $frames.Count; $i++) {
    $size = $sizes[$i]; $bytes = $frames[$i]
    $dimension = if ($size -eq 256) { [byte]0 } else { [byte]$size }
    $writer.Write($dimension); $writer.Write($dimension); $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([UInt16]1); $writer.Write([UInt16]32); $writer.Write([UInt32]$bytes.Length); $writer.Write([UInt32]$offset)
    $offset += $bytes.Length
  }
  foreach ($bytes in $frames) { $writer.Write($bytes) }
} finally { $writer.Dispose(); $file.Dispose() }
Write-Host "Created simple H icon ($($sizes -join ', ') px): $path"
