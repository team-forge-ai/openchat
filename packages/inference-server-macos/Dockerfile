# MLX Engine Server Docker Image
# Note: This is experimental and requires macOS host for Apple Silicon support

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/
COPY pyproject.toml .
COPY README.md .

# Install the package
RUN pip install --no-cache-dir -e .

# Create directories for models and logs
RUN mkdir -p /models /logs

# Expose port
EXPOSE 8000

# Set environment variables
ENV MLX_SERVER_HOST=0.0.0.0
ENV MLX_SERVER_PORT=8000
ENV MLX_SERVER_MODELS_DIR=/models
ENV MLX_SERVER_LOGS_DIR=/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run server
CMD ["mlx-server", "--host", "0.0.0.0", "--port", "8000"]