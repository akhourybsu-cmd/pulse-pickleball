param(
  [Parameter(Mandatory = $true)]
  [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$taskRepoRoot = Split-Path -Parent $PSScriptRoot
$taskEnvPath = Join-Path $taskRepoRoot '.env'
$taskLines = Get-Content -LiteralPath $taskEnvPath
$taskSourceUrl = ''
$taskSourceAnonKey = ''

foreach ($taskLine in $taskLines) {
  if ($taskLine.StartsWith('VITE_SUPABASE_URL=')) {
    $taskSourceUrl = $taskLine.Substring($taskLine.IndexOf('=') + 1).Trim('"')
  }
  if ($taskLine.StartsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
    $taskSourceAnonKey = $taskLine.Substring($taskLine.IndexOf('=') + 1).Trim('"')
  }
}

if (-not $taskSourceUrl -or -not $taskSourceAnonKey) {
  throw 'The source Supabase URL or public key is missing from .env.'
}

$taskBuckets = @(
  'avatars',
  'tournament-assets',
  'group-files',
  'venue-logos',
  'groups',
  'group-post-images',
  'group-message-images'
)

$taskHeaders = @{
  apikey = $taskSourceAnonKey
  Authorization = "Bearer $taskSourceAnonKey"
}

$taskResolvedRoot = [System.IO.Path]::GetFullPath($OutputRoot)
New-Item -ItemType Directory -Force -Path $taskResolvedRoot | Out-Null
$taskManifestRows = [System.Collections.Generic.List[object]]::new()

function Invoke-TaskRequest {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Operation,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  $taskLastError = $null
  foreach ($taskAttempt in 1..4) {
    try {
      return & $Operation
    }
    catch {
      $taskLastError = $_
      if ($taskAttempt -lt 4) {
        Start-Sleep -Seconds ([Math]::Pow(2, $taskAttempt))
      }
    }
  }

  throw "Failed after four attempts: $Description. $($taskLastError.Exception.Message)"
}

function ConvertTo-TaskEncodedObjectPath {
  param([Parameter(Mandatory = $true)][string]$ObjectPath)

  return (($ObjectPath -split '/') | ForEach-Object {
    [System.Uri]::EscapeDataString($_)
  }) -join '/'
}

function Assert-TaskSafeObjectPath {
  param([Parameter(Mandatory = $true)][string]$ObjectPath)

  $taskSegments = $ObjectPath -split '/'
  foreach ($taskSegment in $taskSegments) {
    if (-not $taskSegment -or $taskSegment -in @('.', '..')) {
      throw "Unsafe storage object path: $ObjectPath"
    }
    if ($taskSegment.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -ge 0) {
      throw "Storage object path is not representable on Windows: $ObjectPath"
    }
  }
}

function Export-TaskStoragePrefix {
  param(
    [Parameter(Mandatory = $true)][string]$Bucket,
    [string]$Prefix = ''
  )

  $taskOffset = 0
  $taskLimit = 100

  do {
    $taskRequestBody = @{
      prefix = $Prefix
      limit = $taskLimit
      offset = $taskOffset
      sortBy = @{ column = 'name'; order = 'asc' }
    } | ConvertTo-Json -Depth 4

    $taskResponse = Invoke-TaskRequest -Description "list $Bucket/$Prefix" -Operation {
      Invoke-RestMethod `
        -Method Post `
        -Uri "$taskSourceUrl/storage/v1/object/list/$Bucket" `
        -Headers $taskHeaders `
        -ContentType 'application/json' `
        -Body $taskRequestBody
    }
    $taskItems = @($taskResponse | ForEach-Object { $_ })

    foreach ($taskItem in $taskItems) {
      [string]$taskItemName = $taskItem.name
      [string]$taskObjectPath = if ($Prefix) { "$Prefix$taskItemName" } else { $taskItemName }

      if ($null -eq $taskItem.id -and $null -eq $taskItem.metadata) {
        Export-TaskStoragePrefix -Bucket $Bucket -Prefix "$taskObjectPath/"
        continue
      }

      Assert-TaskSafeObjectPath -ObjectPath $taskObjectPath
      $taskRelativePath = Join-Path $Bucket ($taskObjectPath -replace '/', [System.IO.Path]::DirectorySeparatorChar)
      $taskDestination = [System.IO.Path]::GetFullPath((Join-Path $taskResolvedRoot $taskRelativePath))

      if (-not $taskDestination.StartsWith($taskResolvedRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to write outside the export root: $taskObjectPath"
      }

      $taskParent = Split-Path -Parent $taskDestination
      New-Item -ItemType Directory -Force -Path $taskParent | Out-Null
      $taskEncodedPath = ConvertTo-TaskEncodedObjectPath -ObjectPath $taskObjectPath
      $taskObjectUrl = "$taskSourceUrl/storage/v1/object/public/$Bucket/$taskEncodedPath"

      Invoke-TaskRequest -Description "download $Bucket/$taskObjectPath" -Operation {
        Invoke-WebRequest -Uri $taskObjectUrl -OutFile $taskDestination
      } | Out-Null

      $taskFile = Get-Item -LiteralPath $taskDestination
      $taskHash = Get-FileHash -LiteralPath $taskDestination -Algorithm SHA256
      $taskManifestRows.Add([pscustomobject]@{
        bucket = $Bucket
        object_path = $taskObjectPath
        local_relative_path = $taskRelativePath
        bytes = $taskFile.Length
        sha256 = $taskHash.Hash.ToLowerInvariant()
        source_created_at = $taskItem.created_at
        source_updated_at = $taskItem.updated_at
        source_content_type = $taskItem.metadata.mimetype
      })

      Write-Host "Downloaded $Bucket/$taskObjectPath ($($taskFile.Length) bytes)"
    }

    $taskOffset += $taskItems.Count
  } while ($taskItems.Count -eq $taskLimit)
}

foreach ($taskBucket in $taskBuckets) {
  Write-Host "Exporting bucket: $taskBucket"
  Export-TaskStoragePrefix -Bucket $taskBucket
}

$taskManifestPath = Join-Path $taskResolvedRoot 'manifest.csv'
$taskManifestRows | Sort-Object bucket, object_path | Export-Csv -LiteralPath $taskManifestPath -NoTypeInformation -Encoding UTF8

$taskSummary = [pscustomobject]@{
  exported_at_utc = [DateTime]::UtcNow.ToString('o')
  source_project_url = $taskSourceUrl
  bucket_count = $taskBuckets.Count
  object_count = $taskManifestRows.Count
  total_bytes = ($taskManifestRows | Measure-Object -Property bytes -Sum).Sum
  manifest = $taskManifestPath
}

$taskSummary | ConvertTo-Json
