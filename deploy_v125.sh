#!/bin/bash
set -e

echo "=== 1. Desplegando Backend v1.2.5 (Build 39) ==="
rm -rf /home/ubuntu/backend-unpacked && mkdir -p /home/ubuntu/backend-unpacked
tar -xzf /home/ubuntu/backend-dist.tar.gz -C /home/ubuntu/backend-unpacked
cp -rf /home/ubuntu/backend-unpacked/* /home/ubuntu/ultec-backend/dist/
docker restart ultec-backend
echo "Esperando arranque del backend..."
sleep 4

echo "=== 2. Desplegando Frontend v1.2.5 (Build 39) ==="
rm -rf /home/ubuntu/frontend-unpacked && mkdir -p /home/ubuntu/frontend-unpacked
tar -xzf /home/ubuntu/frontend-dist.tar.gz -C /home/ubuntu/frontend-unpacked
docker cp /home/ubuntu/frontend-unpacked/. ultec-frontend:/usr/share/nginx/html/
docker exec ultec-frontend nginx -s reload

echo "=== 3. Verificando Despliegue en Producción ==="
curl -s http://localhost:4000/api/app-version/latest | head -n 30
echo ""
echo "=== DESPLIEGUE FINALIZADO EXITOSAMENTE ==="
