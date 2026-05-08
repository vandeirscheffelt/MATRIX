#!/bin/bash
set -e

echo "==> Deploy: shaikron-simulator"

cd /var/www/matrix

git pull origin main

docker compose -f infra/docker/shaikron-simulator/docker-compose.yml build --no-cache
docker compose -f infra/docker/shaikron-simulator/docker-compose.yml up -d

echo "==> Copiando config nginx..."
cp infra/nginx/shaikron-simulator.conf /etc/nginx/conf.d/shaikron-simulator.conf
nginx -t && nginx -s reload

echo "==> shaikron-simulator no ar: http://sim.scheffelt.xyz"
