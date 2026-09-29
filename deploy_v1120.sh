#!/bin/bash
set -e
echo "=== Desplegando Plataforma ULTEC v1.1.20 (Build 30) - Fase 3.3 Push Notifications ==="

# 1. Despliegue Backend
echo "1. Desplegando dist-backend.tar.gz..."
tar -xzf /home/ubuntu/dist-backend.tar.gz -C /home/ubuntu/ultec-backend/dist/
docker restart ultec-backend

# 2. Despliegue Frontend
echo "2. Desplegando dist-frontend.tar.gz..."
rm -rf /home/ubuntu/ultec-frontend/dist/*
tar -xzf /home/ubuntu/dist-frontend.tar.gz -C /home/ubuntu/ultec-frontend/dist/
docker cp /home/ubuntu/ultec-frontend/dist/. ultec-frontend:/usr/share/nginx/html/
docker exec ultec-frontend nginx -s reload

echo "=== Despliegue v1.1.20 Finalizado con Éxito ==="
