#!/bin/bash
set -e

echo "=== PREPARANDO ENTORNO AISLADO DE PRUEBAS EN VPS (BUILD 39 - v1.2.5) ==="
rm -rf /home/ubuntu/test-dist && mkdir -p /home/ubuntu/test-dist
tar -xzf /home/ubuntu/backend-dist.tar.gz -C /home/ubuntu/test-dist

docker rm -f test-backend 2>/dev/null || true

docker run -d --name test-backend \
  --network supabase_default \
  -p 4001:4000 \
  -v /home/ubuntu/test-dist:/app/dist \
  -v /home/ubuntu/ultec-backend/.env:/app/.env \
  ultec-backend:latest

echo "Esperando arranque de test-backend..."
sleep 4

python3 /home/ubuntu/test_v125_intelligence_cycles.py
TEST_RES=$?

echo "Limpiando contenedor de prueba..."
docker rm -f test-backend 2>/dev/null || true

exit $TEST_RES
