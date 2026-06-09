# ============================================================
# Sprint 10 — Contract tests A/B Node (8080) x Java (8081)  — TIER 1 (GET read-only)
# ============================================================
# Pre: Node em :8080 e Java em :8081, AMBOS no mesmo banco kaizen_java_dev.
#   (Node: DB_NAME=kaizen_java_dev DB_PASSWORD=... PORT=8080 npm run dev)
# Divergencia = bug do Java, nao diferenca de dado.
#
# Classificacao por endpoint:
#   EXACT    = corpo byte-a-byte identico (+ mesmo status)
#   COSMETIC = difere em bytes mas canonico (parse->recompacta) identico
#              => so espacamento de JSONB (texto jsonb do Postgres tem ": "/", ") e/ou ordem de chaves
#   VALUE    = canonico difere => divergencia real de valor (ex: bigint-as-string, date-TZ)
#
# Uso:  powershell -ExecutionPolicy Bypass -File contract-tests/ab-compare.ps1 [-UserId 4]
# ============================================================
param([int]$UserId = 4)

$NODE='http://localhost:8080'; $JAVA='http://localhost:8081'
$tok=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("{`"userId`":$UserId}"))

$endpoints = @(
  '/api/home/resumo',
  '/api/objectives','/api/key-results','/api/programs','/api/directorates','/api/initiatives',
  '/api/program-initiatives','/api/execution-controls',
  '/api/metas','/api/sprints',
  '/api/planos-programas/instrumentos','/api/planos-programas/instrumentos/ancoragem',
  '/api/gestao-estrategica/planos','/api/gestao-estrategica/projetos','/api/gestao-estrategica/tarefas','/api/gestao-estrategica/estatisticas',
  '/api/areas','/api/areas/select','/api/areas/unidades/all',
  '/api/pessoas','/api/ambientes','/api/colaboradores','/api/users',
  '/api/pca-items','/api/pca-items/stats','/api/pca-items/filters','/api/pca-renovacoes',
  '/api/comites','/api/forms',
  '/api/competencias-padrao','/api/competencias-padrao/versao-atual',
  '/api/autoavaliacao','/api/avaliacao-gestor','/api/avaliacao-integrada','/api/avaliacao-integrada/tem-elegiveis',
  '/api/competencias-gestor','/api/competencias-gestor/meu',
  '/api/competencias-gestor/eh-gestor-unidade','/api/competencias-gestor/eh-colaborador-equipe',
  '/api/competencias-gestor/verificar-acesso','/api/competencias-gestor/unidades-autorizadas',
  '/api/competencias-gestor/unidades-lideranca','/api/competencias-gestor/minha-unidade-gestor',
  '/api/competencias-gestor/minhas-unidades-gestor','/api/competencias-gestor/unidades-autorizadas-inventario',
  '/api/competencias-gestor/tecnicas-admin/unidades',
  '/api/processos-negocio'
)

function Get-Resp($base,$path){
  $out = curl.exe -s -w "`n%{http_code}" "$base$path" -H "Authorization: Bearer $tok"
  $lines = $out -split "`n"
  [pscustomobject]@{ Code=$lines[-1]; Body=($lines[0..($lines.Count-2)] -join "`n") }
}
function Canon($s){ try { return ($s | ConvertFrom-Json | ConvertTo-Json -Depth 50 -Compress) } catch { return "<<unparseable:$($s.Length)>>" } }
function OffsetCtx($a,$b){
  $min=[Math]::Min($a.Length,$b.Length); $i=0
  while($i -lt $min -and $a[$i] -eq $b[$i]){ $i++ }
  $s=[Math]::Max(0,$i-30)
  return @(("node@${i}: " + $a.Substring($s,[Math]::Min(80,$a.Length-$s))), ("java@${i}: " + $b.Substring($s,[Math]::Min(80,$b.Length-$s))))
}

$exact=0;$cosmetic=0;$value=0;$statusdiff=0
foreach($ep in $endpoints){
  $n=Get-Resp $NODE $ep; $j=Get-Resp $JAVA $ep
  if($n.Code -ne $j.Code){
    $statusdiff++
    Write-Output ("[STATUS] {0,-3}/{1,-3} {2}" -f $n.Code,$j.Code,$ep)
    Write-Output ("        node: " + $n.Body.Substring(0,[Math]::Min(140,$n.Body.Length)))
    Write-Output ("        java: " + $j.Body.Substring(0,[Math]::Min(140,$j.Body.Length)))
    continue
  }
  if($n.Body -eq $j.Body){ $exact++; Write-Output ("[EXACT ] {0,-3}     {1}" -f $n.Code,$ep); continue }
  if((Canon $n.Body) -eq (Canon $j.Body)){
    $cosmetic++; Write-Output ("[COSMET] {0,-3}     {1}  (jsonb-ws/ordem)" -f $n.Code,$ep); continue
  }
  $value++; Write-Output ("[VALUE ] {0,-3}     {1}" -f $n.Code,$ep)
  foreach($l in (OffsetCtx $n.Body $j.Body)){ Write-Output ("        " + $l) }
}

$total=$endpoints.Count; $green=$exact+$cosmetic
Write-Output ""
Write-Output ("===== TIER 1: {0} endpoints | EXACT={1} | COSMETIC={2} | VALUE-DIV={3} | STATUS-DIFF={4} =====" -f $total,$exact,$cosmetic,$value,$statusdiff)
Write-Output ("      funcionalmente equivalentes (exact+cosmetic) = {0}/{1} ({2}%)" -f $green,$total,([Math]::Round(100.0*$green/$total)))
