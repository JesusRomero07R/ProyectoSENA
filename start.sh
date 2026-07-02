#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -f backend/.env ]; then
  echo "Creando backend/.env con valores por defecto..."
  cat > backend/.env << 'EOF'
SECRET_KEY=super_secret_key_constructora_gg_2026
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
EOF
fi

docker compose up -d --build
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:8080"
