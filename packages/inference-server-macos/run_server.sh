#!/bin/bash

# MLX Engine Server startup script
# Provides easy server management with common configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DEFAULT_PORT=8000
DEFAULT_HOST="127.0.0.1"
DEFAULT_LOG_LEVEL="INFO"

# Function to print colored output
print_color() {
    color=$1
    message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if server is already running
check_running() {
    if [ -f "mlx_server.pid" ]; then
        pid=$(cat mlx_server.pid)
        if ps -p $pid > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to start the server
start_server() {
    if check_running; then
        print_color "$YELLOW" "⚠️  Server is already running (PID: $(cat mlx_server.pid))"
        exit 1
    fi
    
    # Check if model path is provided
    if [ -z "$1" ]; then
        print_color "$RED" "❌ Error: Model path is required"
        print_color "$YELLOW" "Usage: $0 start /path/to/model [options]"
        exit 1
    fi
    
    model_path="$1"
    shift  # Remove model path from arguments
    
    print_color "$GREEN" "🚀 Starting MLX Engine Server..."
    
    # Parse arguments
    port=${PORT:-$DEFAULT_PORT}
    host=${HOST:-$DEFAULT_HOST}
    log_level=${LOG_LEVEL:-$DEFAULT_LOG_LEVEL}
    
    # Build command
    cmd="python -m openchat_mlx_server.main"
    cmd="$cmd $model_path"
    cmd="$cmd --host $host"
    cmd="$cmd --port $port"
    cmd="$cmd --log-level $log_level"
    
    # Add any additional arguments
    if [ $# -gt 0 ]; then
        cmd="$cmd $@"
    fi
    
    print_color "$GREEN" "Running: $cmd"
    
    # Start server
    $cmd &
    
    # Wait a moment and check if it started
    sleep 2
    if check_running; then
        print_color "$GREEN" "✅ Server started successfully"
        print_color "$GREEN" "   URL: http://$host:$port"
        print_color "$GREEN" "   Docs: http://$host:$port/docs"
        print_color "$GREEN" "   Health: http://$host:$port/health"
    else
        print_color "$RED" "❌ Failed to start server"
        exit 1
    fi
}

# Function to stop the server
stop_server() {
    if ! check_running; then
        print_color "$YELLOW" "⚠️  Server is not running"
        exit 0
    fi
    
    print_color "$YELLOW" "Stopping MLX Engine Server..."
    python -m openchat_mlx_server.main --stop
    
    sleep 1
    if ! check_running; then
        print_color "$GREEN" "✅ Server stopped"
    else
        print_color "$RED" "❌ Failed to stop server"
        exit 1
    fi
}

# Function to restart the server
restart_server() {
    stop_server
    sleep 1
    start_server "$@"
}

# Function to show server status
show_status() {
    if check_running; then
        pid=$(cat mlx_server.pid)
        print_color "$GREEN" "✅ Server is running (PID: $pid)"
        
        # Try to get server status
        port=${PORT:-$DEFAULT_PORT}
        host=${HOST:-$DEFAULT_HOST}
        
        if command -v curl &> /dev/null; then
            print_color "$GREEN" "\nServer Status:"
            curl -s "http://$host:$port/v1/mlx/status" | python -m json.tool 2>/dev/null || true
        fi
    else
        print_color "$YELLOW" "⚠️  Server is not running"
    fi
}

# Function to show logs
show_logs() {
    log_file=${LOG_FILE:-"logs/mlx_server.log"}
    
    if [ -f "$log_file" ]; then
        print_color "$GREEN" "📋 Showing logs from $log_file"
        tail -f "$log_file"
    else
        print_color "$YELLOW" "⚠️  Log file not found: $log_file"
        print_color "$YELLOW" "   Try running with LOG_FILE=/path/to/log"
    fi
}

# Function to run tests
run_tests() {
    print_color "$GREEN" "🧪 Running tests..."
    python -m pytest tests/ -v
}

# Function to build binary
build_binary() {
    print_color "$GREEN" "🔨 Building binary..."
    python build.py "$@"
}

# Function to show help
show_help() {
    cat << EOF
MLX Engine Server Management Script

Usage: $0 [command] [options]

Commands:
    start       Start the server with a model
    stop        Stop the server
    restart     Restart the server
    status      Show server status
    logs        Show server logs (tail -f)
    test        Run tests
    build       Build binary
    help        Show this help message

Environment Variables:
    HOST        Server host (default: 127.0.0.1)
    PORT        Server port (default: 8000)
    LOG_LEVEL   Logging level (default: INFO)
    LOG_FILE    Path to log file

Examples:
    # Start with a model
    $0 start /path/to/model

    # Start with custom port
    PORT=8080 $0 start /path/to/model

    # Start with additional arguments
    $0 start /path/to/model --adapter /path/to/adapter --api-key secret

    # Check status
    $0 status

    # View logs
    $0 logs

    # Stop server
    $0 stop
EOF
}

# Main script logic
case "${1:-}" in
    start)
        shift
        start_server "$@"
        ;;
    stop)
        stop_server
        ;;
    restart)
        shift
        restart_server "$@"
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    test)
        run_tests
        ;;
    build)
        shift
        build_binary "$@"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -z "${1:-}" ]; then
            # No command provided, default to start
            start_server
        else
            print_color "$RED" "❌ Unknown command: $1"
            echo ""
            show_help
            exit 1
        fi
        ;;
esac