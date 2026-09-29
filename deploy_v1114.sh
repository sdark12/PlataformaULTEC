#!/usr/bin/env bash
set -e

echo '=== 1. Deploying Backend v1.1.14 ==='
rm -rf /home/ubuntu/ultec-backend/dist/*
tar -xzf /home/ubuntu/dist-backend.tar.gz -C /home/ubuntu/ultec-backend/dist/
docker restart ultec-backend
sleep 3

echo '=== 2. Deploying Frontend v1.1.14 ==='
rm -rf /home/ubuntu/ultec-frontend/*
tar -xzf /home/ubuntu/dist-frontend.tar.gz -C /home/ubuntu/ultec-frontend/
docker cp /home/ubuntu/ultec-frontend/. ultec-frontend:/usr/share/nginx/html/

echo '=== 3. Syncing APK and version.json ==='
if [ -f /home/ubuntu/ultec-frontend/downloads/PlataformaULTEC.apk ]; then
    cp /home/ubuntu/ultec-frontend/downloads/PlataformaULTEC.apk /home/ubuntu/PlataformaULTEC.apk
    cp /home/ubuntu/ultec-frontend/downloads/PlataformaULTEC.apk /home/ubuntu/downloads/PlataformaULTEC.apk 2>/dev/null || true
    echo 'APK synced to /home/ubuntu/PlataformaULTEC.apk'
fi
if [ -f /home/ubuntu/ultec-frontend/downloads/version.json ]; then
    cp /home/ubuntu/ultec-frontend/downloads/version.json /home/ubuntu/version.json
    cp /home/ubuntu/ultec-frontend/downloads/version.json /home/ubuntu/downloads/version.json 2>/dev/null || true
    echo 'version.json synced to /home/ubuntu/version.json'
fi

docker exec ultec-frontend nginx -s reload || docker restart ultec-frontend

echo '=== 4. Backend Health Check ==='
docker logs --tail 25 ultec-backend

echo '=== 5. Version Check ==='
cat /home/ubuntu/version.json

echo 'DEPLOY_V1114_SUCCESS'
