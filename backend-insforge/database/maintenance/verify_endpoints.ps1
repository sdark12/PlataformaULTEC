$baseUrl = "http://localhost:3000/auth/login"
$apiUrl = "http://localhost:3000/api"

$body = @{
    email    = "admin@admin.com"
    password = "password123"
} | ConvertTo-Json

try {
    # 1. Login
    Write-Host "1. Intentando Login..." -ForegroundColor Cyan
    $loginResponse = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body -ContentType "application/json"
    
    if ($loginResponse.token) {
        Write-Host "   Login Exitoso. Token recibido." -ForegroundColor Green
        $headers = @{
            Authorization = "Bearer $($loginResponse.token)"
        }

        # 2. Check Students
        Write-Host "`n2. Verificando GET /api/students..." -ForegroundColor Cyan
        try {
            $students = Invoke-RestMethod -Uri "$apiUrl/students" -Method Get -Headers $headers
            Write-Host "   [OK] Students Endpoint devolvió datos: $($students.Count)" -ForegroundColor Green
        }
        catch {
            Write-Host "   [ERROR] Falló Students: $($_.Exception.Message)" -ForegroundColor Red
        }

        # 3. Check Courses
        Write-Host "`n3. Verificando GET /api/courses..." -ForegroundColor Cyan
        try {
            $courses = Invoke-RestMethod -Uri "$apiUrl/courses" -Method Get -Headers $headers
            Write-Host "   [OK] Courses Endpoint devolvió datos: $($courses.Count)" -ForegroundColor Green
        }
        catch {
            Write-Host "   [ERROR] Falló Courses: $($_.Exception.Message)" -ForegroundColor Red
        }

        # 4. Verificando POST /api/courses (Creation)
        Write-Host "`n4. Verificando POST /api/courses (Creation)..." -ForegroundColor Cyan
        $courseBody = @{
            name        = "Curso Test PowerShell $(Get-Random)"
            description = "Creado desde script de verificacion"
            monthly_fee = 100
            is_active   = $true
        } | ConvertTo-Json

        $createdCourse = $null
        try {
            $createdCourse = Invoke-RestMethod -Uri "$apiUrl/courses" -Method Post -Headers $headers -Body $courseBody -ContentType "application/json" -ErrorAction Stop
            Write-Host "   [OK] Course Created: $($createdCourse.id)" -ForegroundColor Green
        }
        catch {
            Write-Host "   [ERROR] Failed to create course." -ForegroundColor Red
            if ($_.Exception.Response) {
                try {
                    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                    $responseBody = $reader.ReadToEnd()
                    Write-Host "   Response: $responseBody" -ForegroundColor Yellow
                }
                catch {}
            }
        }
        
        # 5. Verificando POST /api/enrollments (Inscripcion)
        Write-Host "`n5. Verificando POST /api/enrollments (Inscripcion)..." -ForegroundColor Cyan
        
        $studentId = $null
        if ($students.Count -gt 0) { $studentId = $students[0].id }
        
        $courseId = $null
        if ($createdCourse) { $courseId = $createdCourse.id }
        elseif ($courses.Count -gt 0) { $courseId = $courses[0].id }

        if ($studentId -and $courseId) {
            Write-Host "   Intentando inscribir Estudiante: $studentId en Curso: $courseId"
            $enrollmentBody = @{
                student_id = $studentId
                course_id  = $courseId
            } | ConvertTo-Json

            try {
                $enrollResponse = Invoke-RestMethod -Uri "$apiUrl/enrollments" -Method Post -Headers $headers -Body $enrollmentBody -ContentType "application/json" -ErrorAction Stop
                Write-Host "   [OK] Enrollment Created: $($enrollResponse | ConvertTo-Json -Depth 2)" -ForegroundColor Green
            }
            catch {
                Write-Host "   [ERROR] Failed to enroll student." -ForegroundColor Red
                if ($_.Exception.Response) {
                    Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)"
                    try {
                        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                        $responseBody = $reader.ReadToEnd()
                        Write-Host "   Response Body: $responseBody" -ForegroundColor Yellow
                    }
                    catch {}
                }
                else {
                    Write-Host "   Error: $($_.Exception.Message)"
                }
            }
        }
        else {
            Write-Host "   [SKIP] Cannot test enrollment: missing student or course ID." -ForegroundColor Yellow
        }

    }
    else {
        Write-Host "   [ERROR] No se recibió token en login." -ForegroundColor Red
    }
}
catch {
    Write-Host "   [FATAL ERROR] Falló Login: $($_.Exception.Message)" -ForegroundColor Red
}
