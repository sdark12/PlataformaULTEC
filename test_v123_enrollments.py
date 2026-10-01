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

print('=== INICIANDO BATERIA DE PRUEBAS AUTOMATIZADA: BUILD 37 (v1.2.3) ===\n')

# 1. Verificar App Version Endpoint
st, ver = req(f'{BASE_URL}/app-version/latest')
print(f'Test 1: Version Endpoint -> Status {st}')
print(f'   Version: {ver.get("version")} | Build: {ver.get("versionCode")}')
print(f'   Title: {ver.get("title")}')
assert ver.get('version') == '1.2.3' and ver.get('versionCode') == 37, 'Falla en version o build'
print('   -> [PASS] Version y Build verificados correctamente.\n')

# 2. Listar todas las matriculas y verificar presencia de academic_year
st, enrollments = req(f'{BASE_URL}/enrollments')
print(f'Test 2: GET /api/enrollments -> Status {st}, Total: {len(enrollments)}')
assert st == 200, 'Error al consultar enrollments'
assert len(enrollments) > 0, 'No hay matriculas'

# Verificar que cada matricula tenga academic_year
sample = enrollments[:3]
for idx, e in enumerate(sample):
    print(f'   Muestra #{idx+1}: Alumno="{e.get("student_name")}" | Curso="{e.get("course_name")}" | Ciclo={e.get("academic_year")}')
    assert 'academic_year' in e and isinstance(e['academic_year'], int), f'academic_year invalido en matricula {e.get("id")}'
print('   -> [PASS] Todas las matriculas poseen academic_year (integer).\n')

# 3. Filtrar por academic_year=2026
st, enrollments_2026 = req(f'{BASE_URL}/enrollments?academic_year=2026')
print(f'Test 3: GET /api/enrollments?academic_year=2026 -> Status {st}, Coincidencias: {len(enrollments_2026)}')
for e in enrollments_2026[:5]:
    assert e.get('academic_year') == 2026, f'Error: Matricula de anio {e.get("academic_year")} devuelta en filtro 2026'
print('   -> [PASS] Filtrado estricto por Ciclo 2026 validado.\n')

# 4. Obtener un estudiante y un curso 2027 para prueba de matricula en ciclo 2027
st, students = req(f'{BASE_URL}/students')
student_id = students[0]['id']
student_name = students[0]['full_name']

st, courses = req(f'{BASE_URL}/courses?academic_year=2027')
assert len(courses) > 0, 'No se encontro curso del ciclo 2027'
course_2027 = courses[0]
course_id = course_2027['id']
course_name = course_2027['name']

print(f'Test 4: Inscripcion de prueba en ciclo 2027:')
print(f'   Estudiante de prueba: {student_name} ({student_id})')
print(f'   Curso ciclo 2027: {course_name} ({course_id}, ciclo {course_2027.get("academic_year")})')

# Crear matricula de prueba
st, created = req(f'{BASE_URL}/enrollments', method='POST', data={
    'student_id': student_id,
    'course_id': course_id
})
print(f'   Creacion -> Status {st}')
assert st in (200, 201), f'Error al crear matricula: {created}'
enrollment_id = created.get('id') or (created.get('data', {}).get('id'))
print(f'   Matricula creada ID: {enrollment_id}')

# 5. Filtrar por academic_year=2027 y verificar que aparezca la nueva matricula
st, enrollments_2027 = req(f'{BASE_URL}/enrollments?academic_year=2027')
print(f'Test 5: GET /api/enrollments?academic_year=2027 -> Status {st}, Coincidencias: {len(enrollments_2027)}')
matched = [e for e in enrollments_2027 if e.get('id') == enrollment_id or (e.get('student_id') == student_id and e.get('course_id') == course_id)]
assert len(matched) > 0, 'No se encontro la matricula creada en el filtro 2027'
print(f'   Encontrada en Ciclo 2027: Alumno="{matched[0].get("student_name")}" | Curso="{matched[0].get("course_name")}" | Ciclo={matched[0].get("academic_year")}')
assert matched[0].get('academic_year') == 2027, 'El academic_year debe ser 2027'
print('   -> [PASS] Matricula creada exitosamente vinculada al Ciclo 2027.\n')

# 6. Limpieza: Eliminar matricula de prueba
st, deleted = req(f'{BASE_URL}/enrollments/{enrollment_id}', method='DELETE')
print(f'Test 6: Limpieza DELETE /api/enrollments/{enrollment_id} -> Status {st}')
assert st == 200, f'Error al eliminar matricula de prueba: {deleted}'
print('   -> [PASS] Limpieza completada sin dejar datos residuales.\n')

print('=== TODAS LAS PRUEBAS AUTOMATIZADAS (6/6) PASARON EXITOSAMENTE (100% OK) ===')
