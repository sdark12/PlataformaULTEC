#!/usr/bin/env bash
set -e

echo '=== 1. Deploying Backend v1.1.17 ==='
tar -xzf /home/ubuntu/dist-backend.tar.gz -C /home/ubuntu/ultec-backend/dist/
docker restart ultec-backend
sleep 3

echo '=== 2. Deploying Frontend v1.1.17 ==='
mkdir -p /home/ubuntu/ultec-frontend/dist
rm -rf /home/ubuntu/ultec-frontend/dist/*
tar -xzf /home/ubuntu/dist-frontend.tar.gz -C /home/ubuntu/ultec-frontend/dist/
docker cp /home/ubuntu/ultec-frontend/dist/. ultec-frontend:/usr/share/nginx/html/

echo '=== 3. Updating Version metadata v1.1.17 ==='
APK_SIZE=$(stat -c%s "/home/ubuntu/PlataformaULTEC.apk" 2>/dev/null || echo 54651711)

cat << VERSION_EOF > /home/ubuntu/version.json
{
  "version": "1.1.17",
  "versionCode": 27,
  "minVersion": "1.0.0",
  "releaseDate": "2026-09-28",
  "downloadUrl": "https://plataformaultec.duckdns.org/downloads/PlataformaULTEC.apk",
  "fileName": "PlataformaULTEC.apk",
  "fileSize": ${APK_SIZE},
  "title": "Actualización v1.1.17 - Arquitectura Multisede Jerárquica y Delegación Regional",
  "releaseNotes": [
    "Arquitectura Multisede Jerárquica: Gobernanza regional con aislamiento estricto por plantel y delegación administrativa segura.",
    "Selector Global de Sede para SuperAdmin: Alternancia instantánea entre consolidado institucional y planteles individuales con refresco reactivo.",
    "Gestión Territorial Avanzada: Contadores de matrícula y cursos en tiempo real por sede con protección contra eliminación de sedes activas."
  ],
  "isCritical": false
}
VERSION_EOF

docker exec ultec-frontend mkdir -p /usr/share/nginx/html/downloads
docker cp /home/ubuntu/version.json ultec-frontend:/usr/share/nginx/html/downloads/version.json

docker exec ultec-frontend nginx -s reload || docker restart ultec-frontend

echo '=== Deployment v1.1.17 Completed Successfully ==='
