/**
 * verify_all_endpoints.js
 * Prueba todos los endpoints principales de PlataformaULTEC y reporta 200 OK
 * Uso: node database/maintenance/verify_all_endpoints.js
 */
const https = require('https');

const BASE_HOST = 'plataforma-ultec.onrender.com';
const API_BASE  = '/api';

// ── Colores en consola ─────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';

let authToken = '';
let testStudentId = '';
let testEnrollmentId = '';
let testRewardId = '';

function request(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const options = { hostname: BASE_HOST, path: API_BASE + path, method, headers };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (c) => (responseBody += c));
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(responseBody); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed, raw: responseBody });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function log(label, status, extra = '') {
  const icon = status >= 200 && status < 300 ? `${GREEN}✔ OK ${status}${RESET}` : `${RED}✘ FAIL ${status}${RESET}`;
  console.log(`  ${icon}  ${label} ${extra ? YELLOW + extra + RESET : ''}`);
}

async function run() {
  console.log(`\n${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}   PlataformaULTEC – Verificación Integral de Endpoints     ${RESET}`);
  console.log(`${CYAN}═══════════════════════════════════════════════════════════${RESET}\n`);

  // ─── 1. Auth ────────────────────────────────────────────────────────────────
  console.log(`${CYAN}[1] Autenticación${RESET}`);
  const login = await request('POST', '/auth/login', { email: 'admin@ultec.edu', password: 'admin123' });
  log('POST /auth/login', login.status);
  if (login.body.token) {
    authToken = login.body.token;
    console.log(`      Token obtenido: ${authToken.slice(0, 20)}...`);
  } else {
    console.log(`  ${RED}No se obtuvo token. Verifica credenciales o que el servidor haya redesplegado.${RESET}`);
  }

  // ─── 2. Settings ────────────────────────────────────────────────────────────
  console.log(`\n${CYAN}[2] Configuración del Sistema${RESET}`);
  const settingsGet = await request('GET', '/settings');
  log('GET  /settings', settingsGet.status);

  const settingsPatch = await request('PUT', '/settings', {
    institution_name: 'ULTEC',
    merit_points_attendance: 10,
    merit_points_perfect_score: 50,
    merit_points_high_grade: 30,
    merit_high_grade_threshold: 90,
    merit_enable_attendance: true,
    merit_enable_grades: true,
  });
  log('PUT  /settings', settingsPatch.status);

  // ─── 3. Students ────────────────────────────────────────────────────────────
  console.log(`\n${CYAN}[3] Estudiantes${RESET}`);
  const studentsGet = await request('GET', '/students');
  log('GET  /students', studentsGet.status);
  if (studentsGet.body.length > 0) testStudentId = studentsGet.body[0].id || studentsGet.body[0].student_id;

  const studentPost = await request('POST', '/students', {
    first_name: 'TestStudent_Merit',
    last_name: 'Verificacion',
    email: `test.merit.${Date.now()}@ultec.edu`,
    phone: '555-0000',
    address: 'Test Address 123',
    date_of_birth: '2000-01-01',
    enrollment_status: 'active',
  });
  log('POST /students', studentPost.status);
  if (studentPost.body.id) testStudentId = studentPost.body.id;
  if (studentPost.body.student_id) testStudentId = studentPost.body.student_id;

  // ─── 4. Courses ─────────────────────────────────────────────────────────────
  console.log(`\n${CYAN}[4] Cursos${RESET}`);
  const coursesGet = await request('GET', '/courses');
  log('GET  /courses', coursesGet.status);
  let testCourseId = '';
  if (coursesGet.body.length > 0) testCourseId = coursesGet.body[0].id || coursesGet.body[0].course_id;

  // ─── 5. Enrollments ─────────────────────────────────────────────────────────
  console.log(`\n${CYAN}[5] Inscripciones${RESET}`);
  const enrollGet = await request('GET', '/enrollments');
  log('GET  /enrollments', enrollGet.status);

  if (testStudentId && testCourseId) {
    const enrollPost = await request('POST', '/enrollments', {
      student_id: testStudentId,
      course_id: testCourseId,
      enrollment_date: new Date().toISOString().split('T')[0],
      status: 'active',
    });
    log('POST /enrollments', enrollPost.status);
    if (enrollPost.body.id) testEnrollmentId = enrollPost.body.id;
    if (enrollPost.body.enrollment_id) testEnrollmentId = enrollPost.body.enrollment_id;
  } else {
    console.log('  ⚠ Saltando POST /enrollments (falta student_id o course_id)');
  }

  // ─── 6. Attendance (con hook de méritos) ────────────────────────────────────
  console.log(`\n${CYAN}[6] Asistencia (con hook de méritos)${RESET}`);
  const attendanceGet = await request('GET', '/attendance');
  log('GET  /attendance', attendanceGet.status);

  if (testEnrollmentId) {
    const attendPost = await request('POST', '/attendance', {
      enrollment_id: testEnrollmentId,
      date: new Date().toISOString().split('T')[0],
      status: 'PRESENT',
    });
    log('POST /attendance (PRESENT → debería dar puntos)', attendPost.status);
  } else {
    console.log('  ⚠ Saltando POST /attendance (falta enrollment_id)');
  }

  // ─── 7. Grades (con hook de méritos) ────────────────────────────────────────
  console.log(`\n${CYAN}[7] Calificaciones (con hook de méritos)${RESET}`);
  const gradesGet = await request('GET', '/grades');
  log('GET  /grades', gradesGet.status);

  if (testEnrollmentId) {
    const gradePost = await request('POST', '/grades', {
      enrollment_id: testEnrollmentId,
      grade_type: 'Examen Final',
      score: 100,
      max_score: 100,
      date: new Date().toISOString().split('T')[0],
    });
    log('POST /grades (score 100 → puntos de nota perfecta)', gradePost.status);
  } else {
    console.log('  ⚠ Saltando POST /grades (falta enrollment_id)');
  }

  // ─── 8. Merits ──────────────────────────────────────────────────────────────
  console.log(`\n${CYAN}[8] Sistema de Méritos y Recompensas${RESET}`);

  // Balance del estudiante de prueba
  if (testStudentId) {
    const balance = await request('GET', `/merits/balance/${testStudentId}`);
    log(`GET  /merits/balance/${testStudentId}`, balance.status,
      balance.body.total_points !== undefined ? `| Puntos: ${balance.body.total_points}` : '');
  }

  // Leaderboard
  const leaderboard = await request('GET', '/merits/leaderboard');
  log('GET  /merits/leaderboard', leaderboard.status,
    Array.isArray(leaderboard.body) ? `| ${leaderboard.body.length} estudiantes` : '');

  // Asignación manual de puntos
  if (testStudentId) {
    const award = await request('POST', '/merits/award', {
      student_id: testStudentId,
      points: 25,
      reason: 'Prueba de verificación automática',
      category: 'manual',
    });
    log('POST /merits/award (asignación manual)', award.status);
  }

  // CRUD de premios (Rewards)
  const rewardPost = await request('POST', '/merits/rewards', {
    name: 'Premio Test Verificación',
    description: 'Premio creado por script de verificación',
    points_required: 100,
    stock: 5,
    is_active: true,
  });
  log('POST /merits/rewards', rewardPost.status);
  if (rewardPost.body.id) testRewardId = rewardPost.body.id;

  const rewardsGet = await request('GET', '/merits/rewards');
  log('GET  /merits/rewards', rewardsGet.status,
    Array.isArray(rewardsGet.body) ? `| ${rewardsGet.body.length} premios` : '');

  if (testRewardId) {
    const rewardPut = await request('PUT', `/merits/rewards/${testRewardId}`, {
      name: 'Premio Test Actualizado',
      stock: 10,
    });
    log(`PUT  /merits/rewards/${testRewardId}`, rewardPut.status);
  }

  // Reclamo de premio
  if (testStudentId && testRewardId) {
    const claim = await request('POST', '/merits/claim', {
      student_id: testStudentId,
      reward_id: testRewardId,
    });
    log('POST /merits/claim', claim.status,
      claim.body.message || (claim.body.error ? `Error: ${claim.body.error}` : ''));
  }

  // Historial de transacciones del estudiante
  if (testStudentId) {
    const txHistory = await request('GET', `/merits/transactions/${testStudentId}`);
    log(`GET  /merits/transactions/${testStudentId}`, txHistory.status,
      Array.isArray(txHistory.body) ? `| ${txHistory.body.length} transacciones` : '');
  }

  // ─── 9. Teachers ─────────────────────────────────────────────────────────────
  console.log(`\n${CYAN}[9] Profesores${RESET}`);
  const teachersGet = await request('GET', '/teachers');
  log('GET  /teachers', teachersGet.status);

  // ─── Resumen ─────────────────────────────────────────────────────────────────
  console.log(`\n${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${GREEN}  Verificación completada.${RESET}`);
  console.log(`${CYAN}═══════════════════════════════════════════════════════════${RESET}\n`);
}

run().catch(console.error);
