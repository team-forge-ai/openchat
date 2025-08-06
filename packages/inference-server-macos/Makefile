# MLX Engine Server Makefile

.PHONY: help venv install dev-install run stop test build clean clean-all docker lint format

# Variables
VENV_DIR := venv
PYTHON := $(VENV_DIR)/bin/python
PIP := $(PYTHON) -m pip
PORT ?= 8000
HOST ?= 127.0.0.1
MODEL ?=

# Helper to check if venv exists
define check_venv
	@if [ ! -f "$(PYTHON)" ]; then \
		echo "Error: Virtual environment not found. Run 'make venv' first."; \
		exit 1; \
	fi
endef 

help: ## Show this help message
	@echo "MLX Engine Server - Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

venv: ## Create virtual environment if it doesn't exist
	@if [ ! -d "$(VENV_DIR)" ]; then \
		echo "Creating virtual environment..."; \
		python3 -m venv $(VENV_DIR); \
		echo "Virtual environment created at $(VENV_DIR)"; \
	else \
		echo "Virtual environment already exists at $(VENV_DIR)"; \
	fi

install: venv ## Install production dependencies
	$(PIP) install -r requirements.txt

dev-install: venv ## Install development dependencies
	$(PIP) install -e ".[dev]"

run: ## Run the server
	$(check_venv)
	@echo "Starting MLX Engine Server on http://$(HOST):$(PORT)"
	$(PYTHON) -m openchat_mlx_server.main --host $(HOST) --port $(PORT) $(if $(MODEL), $(MODEL))

stop: ## Stop the server
	$(check_venv)
	$(PYTHON) -m openchat_mlx_server.main --stop

test: ## Run tests
	$(check_venv)
	$(PYTHON) -m pytest tests/ -v

test-cov: ## Run tests with coverage
	$(check_venv)
	$(PYTHON) -m pytest tests/ --cov=openchat_mlx_server --cov-report=html --cov-report=term

build: ## Build standalone binary
	$(check_venv)
	$(PYTHON) build.py

build-dist: ## Build distribution package
	$(check_venv)
	$(PYTHON) build.py --dist

clean: ## Clean build artifacts
	rm -rf build/ dist/ *.egg-info/ .pytest_cache/ .coverage htmlcov/
	rm -rf openchat-mlx-server-dist/ *.tar.gz
	rm -f mlx_server.pid mlx_server.spec
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete

clean-all: clean ## Clean everything including venv
	rm -rf $(VENV_DIR)

lint: ## Run linting
	$(check_venv)
	$(PYTHON) -m black --check src/ tests/
	$(PYTHON) -m isort --check-only src/ tests/
	$(PYTHON) -m mypy src/

format: ## Format code
	$(check_venv)
	$(PYTHON) -m black src/ tests/
	$(PYTHON) -m isort src/ tests/

setup-dev: dev-install ## Set up development environment
	@echo "Development environment ready!"
	@echo "Virtual environment: $(VENV_DIR)"
	@echo "Run 'make run' to start the server"

check: lint test ## Run all checks (lint + test)
	@echo "All checks passed!"

release: clean test build build-dist ## Prepare a release
	@echo "Release artifacts created in dist/"

monitor: ## Monitor server logs
	tail -f logs/mlx_server.log 2>/dev/null || echo "No log file found. Start the server first."

status: ## Check server status
	$(check_venv)
	@curl -s http://$(HOST):$(PORT)/health 2>/dev/null | $(PYTHON) -m json.tool || echo "Server not running"

load-model: ## Load a model (requires MODEL variable)
	$(check_venv)
	@if [ -z "$(MODEL)" ]; then \
		echo "Error: MODEL variable not set. Usage: make load-model MODEL=/path/to/model"; \
		exit 1; \
	fi
	@curl -X POST http://$(HOST):$(PORT)/v1/mlx/models/load \
		-H "Content-Type: application/json" \
		-d '{"model_path": "$(MODEL)"}' | $(PYTHON) -m json.tool