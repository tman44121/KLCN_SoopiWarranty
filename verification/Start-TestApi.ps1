[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$SqlServer,

    [ValidateRange(1, 65535)]
    [int]$Port = 8081,

    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$database = 'TrungTamBaoHanhDB_Test_20261015'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$project = Join-Path $root 'backend-dotnet\src\Soopi.Api\Soopi.Api.csproj'

if (-not (Test-Path -LiteralPath $project)) {
    throw 'Không tìm thấy dự án Soopi.Api.'
}
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw 'Chưa tìm thấy dotnet trong PATH.'
}

# Only Windows authentication is used. No connection string is saved to disk
# or passed as a command-line argument.
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source'] = $SqlServer
$builder['Initial Catalog'] = $database
$builder['Integrated Security'] = $true
$builder['Encrypt'] = $true
$builder['TrustServerCertificate'] = $true
$builder['MultipleActiveResultSets'] = $true
$builder['Connect Timeout'] = 5
$builder['Application Name'] = 'Soopi Test API'

$connection = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
try {
    $connection.Open()
    $command = $connection.CreateCommand()
    $command.CommandText = 'SELECT DB_NAME()'
    if ($command.ExecuteScalar() -ne $database) {
        throw 'Kết nối SQL không tới đúng database thử.'
    }
} catch {
    throw "Không xác minh được $database trên SQL Server đã chọn. Dừng trước khi chạy API. $($_.Exception.GetType().Name)"
} finally {
    $connection.Dispose()
}

# Never reuse an arbitrary process already bound to the test port.
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $listener.Start()
} catch {
    throw "Cổng $Port đang được sử dụng. Dừng API thử cũ trước; không dùng run.bat để tái sử dụng tiến trình."
} finally {
    $listener.Stop()
}

Write-Host "Đã kiểm tra DB thử $database; cổng $Port trống."
if ($CheckOnly) {
    return
}

$previousConnection = [Environment]::GetEnvironmentVariable('ConnectionStrings__Default', 'Process')
$previousEnvironment = [Environment]::GetEnvironmentVariable('ASPNETCORE_ENVIRONMENT', 'Process')
try {
    [Environment]::SetEnvironmentVariable('ConnectionStrings__Default', $builder.ConnectionString, 'Process')
    [Environment]::SetEnvironmentVariable('ASPNETCORE_ENVIRONMENT', 'Development', 'Process')
    Write-Host "Đang build API từ mã nguồn hiện tại và chạy trên http://127.0.0.1:$Port"
    & dotnet run --project $project --configuration Release --no-launch-profile -- --urls "http://127.0.0.1:$Port" --Sla:Alerts:Enabled=false
    if ($LASTEXITCODE -ne 0) {
        throw "API thử dừng với mã $LASTEXITCODE."
    }
} finally {
    [Environment]::SetEnvironmentVariable('ConnectionStrings__Default', $previousConnection, 'Process')
    [Environment]::SetEnvironmentVariable('ASPNETCORE_ENVIRONMENT', $previousEnvironment, 'Process')
}
