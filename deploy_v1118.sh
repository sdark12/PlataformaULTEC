#!/usr/bin/env bash
set -e

echo '=== 1. Ensuring Prerequisites in ultec-backend ==='
docker exec -i ultec-backend apk add --no-cache postgresql-client || true
mkdir -p /home/ubuntu/ultec-backend/uploads/backups
chmod 755 /home/ubuntu/ultec-backend/uploads/backups

echo '=== 2. Deploying Backend v1.1.18 ==='
tar -xzf /home/ubuntu/dist-backend.tar.gz -C /home/ubuntu/ultec-backend/dist/
docker restart ultec-backend
sleep 4

# Ensure postgresql-client is present after restart if container was recreated
docker exec -i ultec-backend which pg_dump >/dev/null 2>&1 || docker exec -i ultec-backend apk add --no-cache postgresql-client

echo '=== 3. Deploying Frontend v1.1.18 ==='
mkdir -p /home/ubuntu/ultec-frontend/dist
rm -rf /home/ubuntu/ultec-frontend/dist/*
tar -xzf /home/ubuntu/dist-frontend.tar.gz -C /home/ubuntu/ultec-frontend/dist/
docker cp /home/ubuntu/ultec-frontend/dist/. ultec-frontend:/usr/share/nginx/html/

echo '=== 4. Updating Version metadata v1.1.18 ==='
APK_SIZE=$(stat -c%s "/home/ubuntu/PlataformaULTEC.apk" 2>/dev/null || echo 54651711)

cat << VERSION_EOF > /home/ubuntu/version.json
{
  "version": "1.1.18",
  "versionCode": 28,
  "minVersion": "1.0.0",
  "releaseDate": "2026-09-29",
  "downloadUrl": "https://plataformaultec.duckdns.org/downloads/PlataformaULTEC.apk",
  "fileName": "PlataformaULTEC.apk",
  "fileSize": ${APK_SIZE},
  "title": "Actualización v1.1.18 - Sistema Automatizado de Respaldos y Disaster Recovery",
  "releaseNotes": [
    "Copias de Seguridad Automatizadas: Respaldos programados de base de datos PostgreSQL con compresión Gzip nivel 9 y checksums SHA-256.",
    "Disaster Recovery en Panel DevOps: Generación manual inmediata, historial de descargas y comando oficial de restauración de emergencia.",
    "Política de Retención Inteligente: Depuración automática rotativa manteniendo los últimos 7 respaldos diarios para optimizar disco."
  ],
  "isCritical": false
}
VERSION_EOF

docker exec ultec-frontend mkdir -p /usr/share/nginx/html/downloads
docker cp /home/ubuntu/version.json ultec-frontend:/usr/share/nginx/html/downloads/version.json

docker exec ultec-frontend nginx -s reload || docker restart ultec-frontend

echo '=== Deployment v1.1.18 Completed Successfully ==='
