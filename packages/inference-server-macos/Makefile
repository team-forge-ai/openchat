# MLX Engine Server Makefile

.PHONY: help install dev-install run stop test build clean docker lint format

# Variables
PYTHON := python3
PIP := $(PYTHON) -m pip
PORT ?= 8000
HOST ?= 127.0.0.1
MODEL ?= 

help: ## Show this help message
	@echo "MLX Engine Server - Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install production dependencies
	$(PIP) install -r requirements.txt

dev-install: ## Install development dependencies
	$(PIP) install -e ".[dev]"

run: ## Run the server
	@echo "Starting MLX Engine Server on http://$(HOST):$(PORT)"
	$(PYTHON) -m mlx_engine_server.main --host $(HOST) --port $(PORT) $(if $(MODEL),--model $(MODEL))

stop: ## Stop the server
	$(PYTHON) -m mlx_engine_server.main --stop

test: ## Run tests
	$(PYTHON) -m pytest tests/ -v

test-cov: ## Run tests with coverage
	$(PYTHON) -m pytest tests/ --cov=mlx_engine_server --cov-report=html --cov-report=term

build: ## Build standalone binary
	$(PYTHON) build.py

build-dist: ## Build distribution package
	$(PYTHON) build.py --dist

clean: ## Clean build artifacts
	rm -rf build/ dist/ *.egg-info/ .pytest_cache/ .coverage htmlcov/
	rm -rf mlx-server-dist/ *.tar.gz
	rm -f mlx_server.pid mlx_server.spec
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete

lint: ## Run linting
	$(PYTHON) -m black --check src/ tests/
	$(PYTHON) -m isort --check-only src/ tests/
	$(PYTHON) -m mypy src/

format: ## Format code
	$(PYTHON) -m black src/ tests/
	$(PYTHON) -m isort src/ tests/

docker-build: ## Build Docker image (experimental)
	docker build -t mlx-engine-server:latest .

docker-run: ## Run Docker container (experimental)
	docker run -p $(PORT):8000 mlx-engine-server:latest

setup-dev: dev-install ## Set up development environment
	@echo "Development environment ready!"
	@echo "Run 'make run' to start the server"

check: lint test ## Run all checks (lint + test)
	@echo "All checks passed!"

release: clean test build build-dist ## Prepare a release
	@echo "Release artifacts created in dist/"

monitor: ## Monitor server logs
	tail -f logs/mlx_server.log 2>/dev/null || echo "No log file found. Start the server first."

status: ## Check server status
	@curl -s http://$(HOST):$(PORT)/health 2>/dev/null | python -m json.tool || echo "Server not running"

load-model: ## Load a model (requires MODEL variable)
	@if [ -z "$(MODEL)" ]; then \
		echo "Error: MODEL variable not set. Usage: make load-model MODEL=/path/to/model"; \
		exit 1; \
	fi
	@curl -X POST http://$(HOST):$(PORT)/v1/mlx/models/load \
		-H "Content-Type: application/json" \
		-d '{"model_path": "$(MODEL)"}' | python -m json.tool