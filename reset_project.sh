#!/bin/bash

# Script para reiniciar el proyecto a su estado inicial
# Borra la base de datos, limpia archivos subidos y re-ejecuta el seed.

echo "🧹 Iniciando limpieza del proyecto..."

# 1. Borrar la base de datos SQLite
DB_FILE="database/constructora_gg.db"
if [ -f "$DB_FILE" ]; then
    echo "🗑️ Borrando base de datos: $DB_FILE"
    rm "$DB_FILE"
else
    echo "ℹ️ La base de datos no existe o ya fue borrada."
fi

# 2. Limpiar carpeta de uploads
UPLOADS_DIR="uploads"
if [ -d "$UPLOADS_DIR" ]; then
    echo "📁 Limpiando carpeta de archivos subidos ($UPLOADS_DIR)..."
    rm -rf "$UPLOADS_DIR"/*
else
    echo "ℹ️ La carpeta $UPLOADS_DIR no existe."
fi

# 3. Re-crear tablas y sembrar datos iniciales (Seed)
echo "🌱 Ejecutando script de inicialización (Seed)..."
if [ -d "venv" ]; then
    ./venv/bin/python3 backend/seed.py
elif [ -d "backend/venv" ]; then
    ./backend/venv/bin/python3 backend/seed.py
else
    python3 backend/seed.py
fi

echo "✅ Proyecto reiniciado con éxito."
echo "   - Base de datos recreada."
echo "   - Usuario admin restablecido (admin@constructora-gg.com / admin123)."
echo "   - Carpeta de archivos limpia."
