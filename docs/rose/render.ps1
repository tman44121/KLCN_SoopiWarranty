param([string]$emf, [string]$png, [double]$scale = 4, [double]$extra = 1.0)
# Rasterise a Rose EMF with GDI+ at $scale (vector source, so text stays sharp). $extra enlarges the canvas if needed;
# emf_to_png() then crops to the real content.
Add-Type -AssemblyName System.Drawing
$mf = New-Object System.Drawing.Imaging.Metafile $emf
$w = [int]($mf.Width * $scale); $h = [int]($mf.Height * $scale)
$bmp = New-Object System.Drawing.Bitmap ([int]($w * $extra)), ([int]($h * $extra))
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::White)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($mf, 0, 0, $w, $h)
$bmp.Save($png); $g.Dispose(); $bmp.Dispose(); $mf.Dispose()
