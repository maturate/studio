#!/bin/bash
set -e
cd /opt/superos-studio
cp docker-compose.yml /tmp/docker-compose.yml.bak
sudo tar -xzf /tmp/superos-deploy.tar.gz -C /opt/superos-studio
sudo chown -R $(whoami):$(whoami) /opt/superos-studio
cp /tmp/docker-compose.yml.bak docker-compose.yml
npm install
npm run build --workspace=@superos/web
pm2 restart all
pm2 save
echo "DEPLOY_DONE"
