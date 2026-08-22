# Petit serveur de développement local.
#   Lancer :  powershell -ExecutionPolicy Bypass -File serve.ps1
#   Puis ouvrir http://localhost:8123/
#
# Un simple double-clic sur index.html ne suffit PAS : en ouverture fichier
# (file://), les modules ES ne se chargent pas — les dés 3D et la base de
# règles seraient inertes. Il faut passer par HTTP.
$port = 8123
$root = $PSScriptRoot          # sert le dossier qui contient ce script

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Bones & Blades sur http://localhost:$port/  (Ctrl+C pour arrêter)"

$mime = @{
  ".html"="text/html"; ".js"="text/javascript"; ".mjs"="text/javascript";
  ".css"="text/css"; ".json"="application/json"; ".webmanifest"="application/manifest+json";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".svg"="image/svg+xml";
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".wasm"="application/wasm"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq "") { $rel = "index.html" }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      # Pas de cache : en dev, on veut toujours la dernière version du fichier.
      $ctx.Response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate")
      $ctx.Response.ContentLength64 = $bytes.Length
      # HEAD : en-têtes seulement, jamais de corps (HttpListener lève sinon).
      if ($ctx.Request.HttpMethod -ne "HEAD") { $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length) }
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch { Write-Host "ERR: $_" }
}
