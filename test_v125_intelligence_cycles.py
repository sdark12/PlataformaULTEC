import hmac, hashlib, base64, json, time, urllib.request, urllib.error, sys

secret = 'ULTECjwtSecret2026SuperLongAndSecure!'
now = int(time.time())
exp = now + 86400

def b64url(data):
    if isinstance(data, str):
        data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header = b64url(json.dumps({'alg': 'HS256', 'typ': 'JWT'}))
payload = b64url(json.dumps({
    'sub': '890b3a57-5f91-4bfa-9db6-5888f88660e4',
    'email': 'admin@admin.com',
    'role': 'authenticated',
    'iss': 'supabase',
    'iat': now,
    'exp': exp
}))
msg = f'{header}.{payload}'
sig = b64url(hmac.new(secret.encode(), msg.encode(), hashlib.sha256).digest())
token = f'{msg}.{sig}'

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

BASE_URL = 'http://localhost:4001/api'

def req(url, method='GET', data=None):
    req_obj = urllib.request.Request(url, headers=headers, method=method)
    if data:
        req_obj.data = json.dumps(data).encode('utf-8')
    try:
        with urllib.request.urlopen(req_obj) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        return e.code, json.loads(body) if body else {}

print('=== INICIANDO BATERIA DE PRUEBAS AUTOMATIZADA: BUILD 39 (v1.2.5) ===\n')

# 1. Verificar App Version Endpoint
st, ver = req(f'{BASE_URL}/app-version/latest')
print(f'Test 1: Version Endpoint -> Status {st}')
print(f'   Version: {ver.get("version")} | Build: {ver.get("versionCode")}')
print(f'   Title: {ver.get("title")}')
assert ver.get('version') == '1.2.5' and ver.get('versionCode') == 39, 'Falla en version o build'
print('   -> [PASS] Version 1.2.5 y Build 39 verificados correctamente.\n')

# 2. Consultar EWS Global (Sin filtro de ciclo)
st, ews_global = req(f'{BASE_URL}/intelligence/early-warning?force_refresh=true')
print(f'Test 2: EWS Global -> Status {st}')
assert st == 200, f'Error en EWS Global: {ews_global}'
summary_global = ews_global.get('summary', {})
print(f'   Total Alumnos Global: {summary_global.get("total_students")}, IRE Promedio: {summary_global.get("avg_retention_index")}')
assert summary_global.get('total_students', 0) > 0, 'No hay estudiantes en EWS global'
print('   -> [PASS] EWS Global operativo con cálculo de IRE.\n')

# 3. Consultar EWS Ciclo 2027
st, ews_2027 = req(f'{BASE_URL}/intelligence/early-warning?academic_year=2027&force_refresh=true')
print(f'Test 3: EWS Ciclo 2027 -> Status {st}')
assert st == 200, f'Error en EWS Ciclo 2027: {ews_2027}'
summary_2027 = ews_2027.get('summary', {})
students_2027 = ews_2027.get('students', [])
print(f'   Alumnos Ciclo 2027: {summary_2027.get("total_students")}, Lista: {len(students_2027)}')
# Verificar que los cursos de los alumnos pertenezcan a 2027
for s in students_2027:
    print(f'   Estudiante 2027: {s.get("full_name")} | Cursos: {s.get("courses")}')
    assert any('2027' in str(c) for c in s.get('courses', [])), 'Estudiante no pertenece al ciclo 2027'
print('   -> [PASS] Segmentación estricta de EWS en Ciclo 2027 verificada.\n')

# 4. Consultar EWS Ciclo 2026
st, ews_2026 = req(f'{BASE_URL}/intelligence/early-warning?academic_year=2026&force_refresh=true')
print(f'Test 4: EWS Ciclo 2026 -> Status {st}')
assert st == 200, f'Error en EWS Ciclo 2026: {ews_2026}'
summary_2026 = ews_2026.get('summary', {})
students_2026 = ews_2026.get('students', [])
print(f'   Alumnos Ciclo 2026: {summary_2026.get("total_students")}, Lista: {len(students_2026)}')
# Verificar que no se mezcle TAC1-2027
for s in students_2026:
    assert not any('2027' in str(c) for c in s.get('courses', [])), 'Estudiante 2027 filtrado erróneamente en 2026'
print('   -> [PASS] Segmentación estricta de EWS en Ciclo 2026 verificada sin contaminación.\n')

# 5. Consultar Cartera Vencida (Debt Aging) Global
st, debt_global = req(f'{BASE_URL}/intelligence/debt-aging?force_refresh=true')
print(f'Test 5: Debt Aging Global -> Status {st}')
assert st == 200, f'Error en Debt Aging Global: {debt_global}'
debt_sum_global = debt_global.get('summary', {})
print(f'   Deuda Total Global: Q{debt_sum_global.get("total_debt")}, Total Alumnos: {debt_sum_global.get("total_students")}, Mora: {debt_sum_global.get("delinquency_rate")}%')
assert len(debt_global.get('aging_buckets', [])) == 4, 'Aging buckets incompletos'
print('   -> [PASS] Cartera Vencida Global operativa con 4 aging buckets.\n')

# 6. Consultar Cartera Vencida Ciclo 2027
st, debt_2027 = req(f'{BASE_URL}/intelligence/debt-aging?academic_year=2027&force_refresh=true')
print(f'Test 6: Debt Aging Ciclo 2027 -> Status {st}')
assert st == 200, f'Error en Debt Aging Ciclo 2027: {debt_2027}'
debt_sum_2027 = debt_2027.get('summary', {})
print(f'   Alumnos Ciclo 2027: {debt_sum_2027.get("total_students")}, Meta Esperada: Q{debt_sum_2027.get("current_month_expected")}, Deuda: Q{debt_sum_2027.get("total_debt")}')
assert debt_sum_2027.get('total_students') <= summary_global.get('total_students'), 'Alumnos 2027 mayor que total global'
print('   -> [PASS] Cartera Vencida Ciclo 2027 aislada correctamente.\n')

# 7. Consultar Cartera Vencida Ciclo 2026
st, debt_2026 = req(f'{BASE_URL}/intelligence/debt-aging?academic_year=2026&force_refresh=true')
print(f'Test 7: Debt Aging Ciclo 2026 -> Status {st}')
assert st == 200, f'Error en Debt Aging Ciclo 2026: {debt_2026}'
debt_sum_2026 = debt_2026.get('summary', {})
print(f'   Alumnos Ciclo 2026: {debt_sum_2026.get("total_students")}, Meta Esperada: Q{debt_sum_2026.get("current_month_expected")}, Deuda: Q{debt_sum_2026.get("total_debt")}')
assert debt_sum_2026.get('total_students') <= summary_global.get('total_students'), 'Alumnos 2026 mayor que total global'
print('   -> [PASS] Cartera Vencida Ciclo 2026 aislada correctamente.\n')

print('===================================================================')
print('=== RESULTADO FINAL: 7 DE 7 PRUEBAS SUPERADAS EXITOSAMENTE (100%) ===')
print('===================================================================')
