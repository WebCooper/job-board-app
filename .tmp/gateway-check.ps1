$ErrorActionPreference = 'Stop'

function Base64UrlEncode([byte[]]$bytes) {
    ([Convert]::ToBase64String($bytes)).TrimEnd('=').Replace('+','-').Replace('/','_')
}

$key = Get-Content -Raw 'H:\UOR\7th sem\Cloud Computing\job-board-app\370329703233363376.json' | ConvertFrom-Json
$rsa = [System.Security.Cryptography.RSA]::Create()
$rsa.ImportFromPem($key.key)

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$header = [ordered]@{
    alg = 'RS256'
    typ = 'JWT'
    kid = $key.keyId
} | ConvertTo-Json -Compress

$issuerCandidates = @(
    'https://dev-environment-tcw7bu.us1.zitadel.cloud',
    'dev-environment-tcw7bu.us1.zitadel.cloud',
    'https://dev-environment-tcw7bu.us1.zitadel.cloud/',
    'https://dev-environment-tcw7bu.us1.zitadel.cloud/oidc/v1'
)

function New-Token([string]$issuer) {
    $payload = [ordered]@{
        iss = $issuer
        sub = $key.userId
        iat = $now
        nbf = $now - 5
        exp = $now + 3600
        jti = [guid]::NewGuid().ToString()
    } | ConvertTo-Json -Compress

    $unsigned = "$(Base64UrlEncode([Text.Encoding]::UTF8.GetBytes($header))).$(Base64UrlEncode([Text.Encoding]::UTF8.GetBytes($payload)))"
    $sig = $rsa.SignData([Text.Encoding]::UTF8.GetBytes($unsigned), [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    return "$unsigned.$(Base64UrlEncode($sig))"
}

foreach ($issuer in $issuerCandidates) {
    $token = New-Token $issuer
    Write-Host "TRY_ISS=$issuer"
    try {
        $resp = Invoke-WebRequest -UseBasicParsing -Method Get -Uri 'http://127.0.0.1:8000/api/v1/jobs' -Headers @{ Authorization = "Bearer $token" }
        Write-Host "JOBS_STATUS=$($resp.StatusCode)"
        Write-Host $resp.Content
        break
    } catch {
        Write-Host "JOBS_ERROR=$($_.Exception.Message)"
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            Write-Host "JOBS_DETAILS=$($_.ErrorDetails.Message)"
        }
    }
}
