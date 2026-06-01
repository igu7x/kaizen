# ============================================================
# Sprint 10 — Contract tests A/B  TIER 3 (workflow multi-step, behavioral)
# ============================================================
# Roda o ciclo de vida de Processo de Negocio (validacao 3 camadas) INDEPENDENTEMENTE
# em cada backend (rows isoladas por marker), e compara:
#   - a SEQUENCIA de status codes HTTP de cada passo
#   - o ESTADO final no banco (status, versao, ciclos_homologados, recusado_camada)
# Behavioral (nao byte): imune as divergencias cosmeticas de serializacao do Tier 1.
# Cada run limpa seus proprios artefatos (create -> ... -> delete) -> sem conflito entre backends.
#
# Pre: Node :8080 e Java :8081 no mesmo banco kaizen_java_dev.
# Uso: $env:PGPASSWORD='<senha>'; powershell -ExecutionPolicy Bypass -File contract-tests/ab-workflow.ps1
# (a senha do DB de dev vem da env PGPASSWORD — NÃO versionada, ver application-local.yml)
# ============================================================
if (-not $env:PGPASSWORD) { Write-Error "Defina `$env:PGPASSWORD com a senha do kaizen_java_dev antes de rodar."; exit 2 }
$psql = if ($env:PSQL) { $env:PSQL } else { 'C:\Program Files\PostgreSQL\18\bin\psql.exe' }
function SQL($q){ & $psql -h localhost -U postgres -d kaizen_java_dev -tAc $q }
function VAL($q){ (SQL $q | Where-Object { $_ -ne '' } | Select-Object -First 1) }
$t8=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"userId":8}'))  # MANAGER (autor)
$t4=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"userId":4}'))  # SGJT gestor + superadmin
function Call($method,$url,$tok,$file){
  if($file){ $out=curl.exe -s -w "`n%{http_code}" -X $method $url -H "Authorization: Bearer $tok" -H "Content-Type: application/json" --data "@$file" }
  else     { $out=curl.exe -s -w "`n%{http_code}" -X $method $url -H "Authorization: Bearer $tok" }
  ($out -split "`n")[-1]
}

function RunLifecycle($base,$marker){
  $b="$base/api/processos-negocio"
  # cleanup previo do marker
  SQL "DELETE FROM processos_negocio_historico WHERE processo_id IN (SELECT id FROM processos_negocio WHERE macroprocesso='$marker');" | Out-Null
  SQL "DELETE FROM processos_negocio WHERE macroprocesso='$marker';" | Out-Null

  $fc=New-TemporaryFile
  ('{"macroprocesso":"'+$marker+'","diretoria":"SGJT","nome_processo":"CT","proprietarios":["a"]}') | Set-Content -Encoding utf8 -NoNewline $fc
  $codes=@()
  $codes += Call POST $b $t8 $fc.FullName                     # criar
  $P=VAL "SELECT id FROM processos_negocio WHERE macroprocesso='$marker' ORDER BY id DESC LIMIT 1"
  $codes += Call PATCH "$b/$P/enviar" $t8 $null               # enviar
  $codes += Call PATCH "$b/$P/validar-autor" $t4 $null        # autor errado (u4 != autor u8) -> 403
  $codes += Call PATCH "$b/$P/validar-autor" $t8 $null        # autor ok
  $codes += Call PATCH "$b/$P/validar-diretoria" $t8 $null    # nao-gestor -> 403
  $codes += Call PATCH "$b/$P/validar-diretoria" $t4 $null    # gestor ok
  $codes += Call PATCH "$b/$P/validar-final" $t8 $null        # nao-super -> 403
  $codes += Call PATCH "$b/$P/validar-final" $t4 $null        # super ok (1.0/ciclos1)
  $st1 = "$(VAL "SELECT status FROM processos_negocio WHERE id=$P;")/$(VAL "SELECT versao FROM processos_negocio WHERE id=$P;")/$(VAL "SELECT ciclos_homologados FROM processos_negocio WHERE id=$P;")/snap$(VAL "SELECT count(*) FROM processos_negocio_historico WHERE processo_id=$P;")"
  $codes += Call PATCH "$b/$P/enviar" $t8 $null               # reenviar
  Call PATCH "$b/$P/validar-autor" $t8 $null | Out-Null
  Call PATCH "$b/$P/validar-diretoria" $t4 $null | Out-Null
  $codes += Call PATCH "$b/$P/validar-final" $t4 $null        # 2o ciclo (1.1/ciclos2)
  $st2 = "$(VAL "SELECT versao FROM processos_negocio WHERE id=$P;")/$(VAL "SELECT ciclos_homologados FROM processos_negocio WHERE id=$P;")/snap$(VAL "SELECT count(*) FROM processos_negocio_historico WHERE processo_id=$P;")"
  $fr=New-TemporaryFile; '{"camada":"final","motivo":"ct"}' | Set-Content -Encoding utf8 -NoNewline $fr
  $codes += Call PATCH "$b/$P/recusar" $t4 $fr.FullName       # recusar final
  $st3 = "$(VAL "SELECT status FROM processos_negocio WHERE id=$P;")/$(VAL "SELECT recusado_camada FROM processos_negocio WHERE id=$P;")"
  # cleanup
  SQL "DELETE FROM processos_negocio_historico WHERE processo_id=$P;" | Out-Null
  SQL "DELETE FROM processos_negocio WHERE id=$P;" | Out-Null
  Remove-Item $fc,$fr -ErrorAction SilentlyContinue
  [pscustomobject]@{ Codes=($codes -join ','); After1=$st1; After2=$st2; After3=$st3 }
}

Write-Output "Rodando lifecycle no NODE (8080)..."
$node = RunLifecycle 'http://localhost:8080' '__ct_node__'
Write-Output "Rodando lifecycle no JAVA (8081)..."
$java = RunLifecycle 'http://localhost:8081' '__ct_java__'

Write-Output ""
Write-Output ("codes  node = " + $node.Codes)
Write-Output ("codes  java = " + $java.Codes)
Write-Output ("  esperado    = 201,200,403,200,403,200,403,200,200,200,200")
Write-Output ("after1 node = " + $node.After1 + "   java = " + $java.After1 + "   (esp validado_final/1.0/1/snap1)")
Write-Output ("after2 node = " + $node.After2 + "   java = " + $java.After2 + "   (esp 1.1/2/snap2)")
Write-Output ("after3 node = " + $node.After3 + "   java = " + $java.After3 + "   (esp recusado/final)")
$ok = ($node.Codes -eq $java.Codes) -and ($node.After1 -eq $java.After1) -and ($node.After2 -eq $java.After2) -and ($node.After3 -eq $java.After3)
Write-Output ""
Write-Output ("===== TIER 3 (workflow Processo): " + $(if($ok){"PARIDADE TOTAL Node==Java"}else{"DIVERGENCIA"}) + " =====")
