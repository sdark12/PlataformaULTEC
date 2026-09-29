#!/usr/bin/env bash
set -e

echo '=== 1. Deploying Backend v1.1.16 ==='
tar -xzf /home/ubuntu/dist-backend.tar.gz -C /home/ubuntu/ultec-backend/dist/
docker restart ultec-backend
sleep 3

echo '=== 2. Deploying Frontend v1.1.16 ==='
mkdir -p /home/ubuntu/ultec-frontend/dist
rm -rf /home/ubuntu/ultec-frontend/dist/*
tar -xzf /home/ubuntu/dist-frontend.tar.gz -C /home/ubuntu/ultec-frontend/dist/
docker cp /home/ubuntu/ultec-frontend/dist/. ultec-frontend:/usr/share/nginx/html/

echo '=== 3. Updating Version metadata v1.1.16 ==='
APK_SIZE=$(stat -c%s "/home/ubuntu/PlataformaULTEC.apk" 2>/dev/null || echo 54651711)

cat << VERSION_EOF > /home/ubuntu/version.json
{
  "version": "1.1.16",
  "versionCode": 26,
  "minVersion": "1.0.0",
  "releaseDate": "2026-09-28",
  "downloadUrl": "https://plataformaultec.duckdns.org/downloads/PlataformaULTEC.apk",
  "fileName": "PlataformaULTEC.apk",
  "fileSize": ${APK_SIZE},
  "title": "Actualización v1.1.16 - Panel DevOps y Telemetría en Vivo de Infraestructura",
  "releaseNotes": [
    "Panel DevOps y Telemetría de Servidor: Monitorización en tiempo real de CPU, RAM, Disco del VPS y estado de Node.js.",
    "Métricas de Base de Datos PostgreSQL: Conexiones activas, tamaño físico de base de datos y tiempo de actividad (uptime) en vivo.",
    "Inventario Operativo en Tiempo Real: Contadores consolidados de alumnos, pagos, calificaciones y eventos auditados para SuperAdmin."
  ],
  "isCritical": false
}
VERSION_EOF

docker exec ultec-frontend mkdir -p /usr/share/nginx/html/downloads
docker cp /home/ubuntu/version.json ultec-frontend:/usr/share/nginx/html/downloads/version.json

docker exec ultec-frontend nginx -s reload || docker restart ultec-frontend

echo '=== Deployment v1.1.16 Completed Successfully ==='
