# StaffSync Backend - Docker Commands
# Usage: make <command>

.PHONY: help dev up down logs shell db-shell db-push db-migrate db-seed db-studio clean build prod

# Default target
help:
	@echo "StaffSync Backend - Available Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start all services (DB + API with hot reload)"
	@echo "  make up           - Start only PostgreSQL database"
	@echo "  make down         - Stop all services"
	@echo "  make logs         - View API logs"
	@echo "  make shell        - Open shell in API container"
	@echo ""
	@echo "Database:"
	@echo "  make db-shell     - Open PostgreSQL shell"
	@echo "  make db-push      - Push Prisma schema to database"
	@echo "  make db-migrate   - Run Prisma migrations"
	@echo "  make db-seed      - Seed database with initial data"
	@echo "  make db-studio    - Open Prisma Studio"
	@echo "  make db-reset     - Reset database (WARNING: deletes all data)"
	@echo ""
	@echo "Production:"
	@echo "  make build        - Build production Docker image"
	@echo "  make prod         - Start production stack"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Remove containers, volumes, and images"

# ==========================================
# Development Commands
# ==========================================

# Start everything (DB + API)
dev:
	docker-compose up -d
	@echo ""
	@echo "✅ StaffSync is running!"
	@echo "   API:      http://localhost:3001"
	@echo "   pgAdmin:  http://localhost:5050"
	@echo ""
	@echo "Run 'make logs' to see API output"

# Start only database
up:
	docker-compose up -d postgres pgadmin
	@echo ""
	@echo "✅ PostgreSQL is running on localhost:5432"
	@echo "   pgAdmin:  http://localhost:5050"
	@echo ""
	@echo "Connect with: postgresql://staffsync:staffsync_dev_123@localhost:5432/staffsync"

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f api

# API container shell
shell:
	docker-compose exec api sh

# ==========================================
# Database Commands
# ==========================================

# PostgreSQL shell
db-shell:
	docker-compose exec postgres psql -U staffsync -d staffsync

# Push schema to DB (no migration history)
db-push:
	docker-compose exec api npx prisma db push

# Run migrations
db-migrate:
	docker-compose exec api npx prisma migrate dev

# Seed database
db-seed:
	docker-compose exec api npx prisma db seed

# Open Prisma Studio
db-studio:
	@echo "Opening Prisma Studio..."
	@echo "Run this locally: npx prisma studio"
	npx prisma studio

# Reset database (WARNING!)
db-reset:
	@echo "⚠️  This will DELETE all data. Press Ctrl+C to cancel."
	@sleep 3
	docker-compose exec api npx prisma migrate reset --force

# ==========================================
# Production Commands
# ==========================================

# Build production image
build:
	docker build -t staffsync-api:latest .

# Start production stack
prod:
	docker-compose -f docker-compose.prod.yml up -d

# ==========================================
# Cleanup Commands
# ==========================================

# Remove everything
clean:
	docker-compose down -v --rmi local
	@echo "✅ Cleaned up containers, volumes, and images"

# ==========================================
# Local Development (without Docker)
# ==========================================

# Install dependencies locally
install:
	npm install

# Run locally (requires local PostgreSQL)
local:
	npm run dev

# Generate Prisma client
generate:
	npx prisma generate
