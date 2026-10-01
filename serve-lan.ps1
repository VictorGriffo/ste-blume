$port = 8124
$root = $PSScriptRoot

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css"
  ".js"   = "application/javascript"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()
Write-Host "Serving $root on http://192.168.0.132:$port/"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $requestLine = $reader.ReadLine()
    # drain headers
    while (-not [string]::IsNullOrEmpty($reader.ReadLine())) {}

    $path = "/index.html"
    if ($requestLine -match '^(GET|HEAD)\s+(\S+)\s+HTTP') {
      $path = $matches[2]
    }
    $path = $path -split '\?' | Select-Object -First 1
    if ($path -eq "/") { $path = "/index.html" }
    $path = [System.Uri]::UnescapeDataString($path)
    $filePath = Join-Path $root ($path.TrimStart("/"))

    $writer = New-Object System.IO.StreamWriter($stream)
    $writer.AutoFlush = $false
    $writer.NewLine = "`r`n"

    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath)
      $contentType = $mime[$ext]
      if (-not $contentType) { $contentType = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $writer.WriteLine("HTTP/1.1 200 OK")
      $writer.WriteLine("Content-Type: $contentType")
      $writer.WriteLine("Content-Length: $($bytes.Length)")
      $writer.WriteLine("Connection: close")
      $writer.WriteLine("")
      $writer.Flush()
      $stream.Write($bytes, 0, $bytes.Length)
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $writer.WriteLine("HTTP/1.1 404 Not Found")
      $writer.WriteLine("Content-Type: text/plain")
      $writer.WriteLine("Content-Length: $($body.Length)")
      $writer.WriteLine("Connection: close")
      $writer.WriteLine("")
      $writer.Flush()
      $stream.Write($body, 0, $body.Length)
    }
    $stream.Flush()
  } catch {
  } finally {
    $client.Close()
  }
}
