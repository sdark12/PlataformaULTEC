#!/usr/bin/env bash
set -e

echo '=== 1. Deploying Backend ==='
rm -rf /home/ubuntu/ultec-backend/dist/*
tar -xzf /home/ubuntu/dist-backend.tar.gz -C /home/ubuntu/ultec-backend/dist/
docker restart ultec-backend
sleep 3

echo '=== 2. Deploying Frontend ==='
rm -rf /home/ubuntu/ultec-frontend/*
tar -xzf /home/ubuntu/dist-frontend.tar.gz -C /home/ubuntu/ultec-frontend/
docker cp /home/ubuntu/ultec-frontend/. ultec-frontend:/usr/share/nginx/html/

echo '=== 3. Deploying APK & Metadata ==='
mkdir -p /home/ubuntu/downloads
cp /home/ubuntu/PlataformaULTEC.apk /home/ubuntu/downloads/PlataformaULTEC.apk
docker exec ultec-frontend mkdir -p /usr/share/nginx/html/downloads
docker cp /home/ubuntu/PlataformaULTEC.apk ultec-frontend:/usr/share/nginx/html/downloads/PlataformaULTEC.apk

APK_SIZE=$(stat -c%s "/home/ubuntu/PlataformaULTEC.apk" 2>/dev/null || echo 5337364)

cat << VERSION_EOF > /home/ubuntu/version.json
{
  "version": "1.1.5",
  "versionCode": 15,
  "minVersion": "1.0.0",
  "releaseDate": "2026-09-26",
  "downloadUrl": "https://plataformaultec.duckdns.org/downloads/PlataformaULTEC.apk",
  "fileName": "PlataformaULTEC.apk",
  "fileSize": ${APK_SIZE},
  "title": "Actualizacion Oficial (v1.1.5)",
  "releaseNotes": [
    "Integracion de Puntos de Merito (Recompensa) para gamificacion en las tareas y actividades escolares.",
    "Asignacion y filtrado de tareas por Bimestre / Unidad academica.",
    "Reemplazo de peso multiplicador por puntos de merito canjeables en la tienda escolar y ranking.",
    "Otorgamiento automatico de puntos de merito al calificar entregas (60% o mas de punteo) con opcion de merito personalizado."
  ],
  "isCritical": false
}
VERSION_EOF

cp /home/ubuntu/version.json /home/ubuntu/downloads/version.json
docker cp /home/ubuntu/version.json ultec-frontend:/usr/share/nginx/html/downloads/version.json

docker exec ultec-frontend nginx -s reload || docker restart ultec-frontend

echo 'DEPLOY_COMPLETE_SUCCESS'
