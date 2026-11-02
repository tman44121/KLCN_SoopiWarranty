[CmdletBinding()]
param(
    [ValidateSet('localhost,1433', '127.0.0.1,1433', 'localhost', '.')][string]$Server = 'localhost,1433',
    [ValidateSet('TrungTamBaoHanhDB_Dev', 'TrungTamBaoHanhDB_KiemThu')][string]$Database = 'TrungTamBaoHanhDB_Dev',
    [ValidateRange(600, 3000)][int]$Tickets = 600,
    [ValidateRange(400, 2000)][int]$Customers = 400,
    [string]$StorageDirectory = ''
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$runDir = Join-Path $repo "artifacts/local-reset/$stamp-$([guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null
$sqlcmd = (Get-Command sqlcmd -ErrorAction Stop).Source
$python = (Get-Command python -ErrorAction Stop).Source
if (!$StorageDirectory) { $StorageDirectory = Join-Path $repo 'backend-dotnet/src/Soopi.Api/data/files' }
$fixture = Join-Path ([IO.Path]::GetFullPath($StorageDirectory)) 'seed/signatures/blank.png'
if (!(Test-Path $fixture)) {
    Add-Type -AssemblyName System.Drawing
    New-Item -ItemType Directory -Path (Split-Path $fixture) -Force | Out-Null
    $bitmap = New-Object System.Drawing.Bitmap 640,180
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $font = New-Object System.Drawing.Font 'Arial',20
    try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.DrawString('LOCAL TEST - signature fixture', $font, [System.Drawing.Brushes]::DarkSlateGray, 30, 65)
        $bitmap.Save($fixture, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $font.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}
$fixtureSize = (Get-Item $fixture).Length
function Invoke-LocalSql([string]$Db, [string]$Query, [string]$File) {
    $arguments = @('-S', $Server, '-d', $Db, '-E', '-C', '-I', '-b', '-f', '65001', '-h', '-1', '-W', '-w', '65535')
    if ($File) { $arguments += @('-i', $File) } else { $arguments += @('-Q', $Query) }
    $output = & $sqlcmd @arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
    return $output
}
$files = @('01_schema.sql','02_reference_data.sql','03_demo_data.sql')
$upgrades = @('05_upgrade_existing_db.sql','06_chat.sql','07_access_statistics.sql','08_public_reviews.sql','10_legacy_review_publication.sql')
foreach ($file in ($files + $upgrades)) { if (!(Test-Path (Join-Path $repo "database/$file"))) { throw "Missing $file" } }
$preflight = "SET NOCOUNT ON; IF DB_NAME() NOT IN (N'TrungTamBaoHanhDB_Dev',N'TrungTamBaoHanhDB_KiemThu') THROW 50000,N'Only a local test database is allowed.',1; IF CAST(SERVERPROPERTY('IsLocalDB') AS int)=1 THROW 50000,N'Use the configured local SQL Server.',1; SELECT N'BACKUP_DIR|'+CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000));"
$preflightOutput = Invoke-LocalSql $Database $preflight
$backupDir = (($preflightOutput | Where-Object { "$_" -like 'BACKUP_DIR|*' }) -split '\|',2)[1]
if (!$backupDir) { throw 'SQL Server did not report a backup directory. No data changed.' }
$backup = $backupDir.TrimEnd('\') + "\$Database-before-reset-$stamp-$([guid]::NewGuid().ToString('N').Substring(0,8)).bak"
$backupLiteral = $backup.Replace("'", "''")
Write-Host "Backing up $Database..."
Invoke-LocalSql $Database "BACKUP DATABASE [$Database] TO DISK=N'$backupLiteral' WITH COPY_ONLY,CHECKSUM; RESTORE VERIFYONLY FROM DISK=N'$backupLiteral' WITH CHECKSUM;" | Set-Content (Join-Path $runDir 'backup.log') -Encoding utf8
$backup | Set-Content (Join-Path $runDir 'backup-path.txt') -Encoding utf8
Write-Host "Verified backup: $backup"

# Prove the complete seed on an isolated database before touching the target's rows.
$staging = "SoopiSeed_${stamp}_$([guid]::NewGuid().ToString('N').Substring(0,8))"
$stageCreated = $false
try {
    Invoke-LocalSql 'master' "CREATE DATABASE [$staging] COLLATE Latin1_General_100_CI_AI;" | Out-Null
    $stageCreated = $true
    foreach ($file in $files) { Invoke-LocalSql $staging '' (Join-Path $repo "database/$file") | Out-Null }
    foreach ($file in $upgrades) { Invoke-LocalSql $staging '' (Join-Path $repo "database/$file") | Out-Null }
    $bulk = Join-Path $runDir 'bulk.sql'
    & $python -X utf8 (Join-Path $PSScriptRoot 'generate_bulk_data.py') --server $Server --db $staging --tickets $Tickets --customers $Customers --workflow-cases --out $bulk > (Join-Path $runDir 'generator.log')
    if ($LASTEXITCODE -ne 0) { throw 'Seed generation failed. Target data remains unchanged.' }
    Invoke-LocalSql $staging '' $bulk | Out-Null
    Invoke-LocalSql $staging '' (Join-Path $PSScriptRoot 'workflow-cases.sql') | Set-Content (Join-Path $runDir 'staging-cases.log') -Encoding utf8

    $resetSql = @"
SET NOCOUNT ON; SET XACT_ABORT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON;
IF DB_NAME() <> N'$Database' THROW 50000,N'Wrong database. Reset stopped.',1;
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sp_getapplock @Resource=N'SoopiLocalReset',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
IF @lock < 0 THROW 50000,N'Another reset is running.',1;
GO
"@
    foreach ($file in $upgrades) { $resetSql += "`n" + [IO.File]::ReadAllText((Join-Path $repo "database/$file")) + "`nGO`n" }
    $resetSql += @"
DECLARE @sql nvarchar(max)=N'';
SELECT @sql += N'ALTER TABLE '+QUOTENAME(SCHEMA_NAME(schema_id))+N'.'+QUOTENAME(name)+N' NOCHECK CONSTRAINT ALL;' FROM sys.tables WHERE is_ms_shipped=0;
EXEC sp_executesql @sql;
SET @sql=N'';
SELECT @sql += N'DELETE FROM '+QUOTENAME(SCHEMA_NAME(schema_id))+N'.'+QUOTENAME(name)+N';' FROM sys.tables WHERE is_ms_shipped=0;
EXEC sp_executesql @sql;
SET @sql=N'';
SELECT @sql += N'DBCC CHECKIDENT ('''+REPLACE(QUOTENAME(SCHEMA_NAME(t.schema_id))+N'.'+QUOTENAME(t.name),'''','''''')+N''', RESEED, 0) WITH NO_INFOMSGS;' FROM sys.tables t WHERE is_ms_shipped=0 AND EXISTS(SELECT 1 FROM sys.identity_columns c WHERE c.object_id=t.object_id);
EXEC sp_executesql @sql;
GO
"@
    foreach ($file in @('02_reference_data.sql','03_demo_data.sql')) { $resetSql += "`n" + [IO.File]::ReadAllText((Join-Path $repo "database/$file")) + "`nGO`n" }
    # Upgrade scripts also seed required singleton/configuration rows removed by the reset.
    foreach ($file in $upgrades) { $resetSql += "`n" + [IO.File]::ReadAllText((Join-Path $repo "database/$file")) + "`nGO`n" }
    $resetSql += [IO.File]::ReadAllText($bulk) + "`nGO`n" + [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'workflow-cases.sql')) + "`nGO`n"
    $resetSql += "UPDATE TepDinhKem SET KichThuoc=$fixtureSize WHERE DuongDanLuuTru=N'seed/signatures/blank.png';`n"
    $resetSql += @'
DECLARE @sql nvarchar(max)=N'';
SELECT @sql += N'ALTER TABLE '+QUOTENAME(SCHEMA_NAME(schema_id))+N'.'+QUOTENAME(name)+N' WITH CHECK CHECK CONSTRAINT ALL;' FROM sys.tables WHERE is_ms_shipped=0;
EXEC sp_executesql @sql;
IF @@TRANCOUNT <> 1 THROW 50000,N'Unexpected transaction nesting. Reset rolled back.',1;
IF (SELECT COUNT(*) FROM MocThongKeTruyCap WHERE Id=1) <> 1 THROW 50000,N'Missing access tracking configuration.',1;
COMMIT;
'@
    $resetFile = Join-Path $runDir 'reset-transaction.sql'
    [IO.File]::WriteAllText($resetFile, $resetSql, [Text.UTF8Encoding]::new($false))
    Write-Host 'Seed validated. Replacing target rows in one transaction...'
    $result = Invoke-LocalSql $Database '' $resetFile
    $result | Set-Content (Join-Path $runDir 'reset.log') -Encoding utf8
    $cases = @($result | Where-Object { "$_" -like 'CASE|*' } | ForEach-Object {
        $v = "$_" -split '\|',6
        [pscustomobject]@{ case=$v[1]; code=$v[2]; account=$v[3]; action=$v[4]; expected=$v[5] }
    })
    $cases | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $runDir 'cases.json') -Encoding utf8
    [pscustomobject]@{ database=$Database; server=$Server; backup=$backup; cases=$cases.Count; runDirectory=$runDir } | ConvertTo-Json | Set-Content (Join-Path $runDir 'result.json') -Encoding utf8
    Write-Host "Reset complete. $($cases.Count) cases: $runDir\cases.json"
    Write-Host 'Sign in again in the local website; old sessions have been cleared.'
} finally {
    if ($stageCreated -and $staging -match '^SoopiSeed_\d{14}_[a-f0-9]{8}$') {
        Invoke-LocalSql 'master' "ALTER DATABASE [$staging] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$staging];" | Out-Null
    }
}
