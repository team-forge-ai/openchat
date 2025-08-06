#!/usr/bin/env python3
"""Build script for creating MLX Engine Server binary."""

import os
import sys
import shutil
import subprocess
from pathlib import Path
import platform


def check_pyinstaller():
    """Check if PyInstaller is installed."""
    try:
        import PyInstaller
        return True
    except ImportError:
        print("PyInstaller not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller>=6.0.0"], check=True)
        return True


def build_binary():
    """Build the MLX Engine Server binary."""
    # Check platform
    if platform.system() != "Darwin":
        print("Warning: This server is optimized for macOS with Apple Silicon.")
        print("Building on other platforms may not work correctly.")
    
    # Check PyInstaller
    if not check_pyinstaller():
        print("Failed to install PyInstaller")
        return False
    
    # Clean previous builds
    print("Cleaning previous builds...")
    for dir_name in ["build", "dist"]:
        if Path(dir_name).exists():
            shutil.rmtree(dir_name)
    
    # Prepare PyInstaller spec
    spec_content = """
# -*- mode: python ; coding: utf-8 -*-

import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path.cwd() / 'src'))

a = Analysis(
    ['src/mlx_engine_server/main.py'],
    pathex=['src'],
    binaries=[],
    datas=[],
    hiddenimports=[
        'mlx',
        'mlx.core',
        'mlx.nn',
        'mlx.optimizers',
        'mlx.utils',
        'mlx_lm',
        'mlx_lm.models',
        'mlx_lm.tokenizer_utils',
        'mlx_lm.utils',
        'transformers',
        'transformers.models',
        'sentencepiece',
        'tiktoken',
        'fastapi',
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'httpx',
        'httpcore',
        'h11',
        'anyio',
        'sniffio',
        'starlette',
        'pydantic',
        'psutil',
        'multipart',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'notebook',
        'IPython',
        'jupyter',
        'pytest',
        'black',
        'isort',
        'mypy',
    ],
    noarchive=False,
    optimize=2,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='mlx-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch='arm64' if platform.machine() == 'arm64' else None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
"""
    
    # Write spec file
    spec_file = Path("mlx_server.spec")
    spec_file.write_text(spec_content)
    
    print("Building MLX Engine Server binary...")
    print("This may take a few minutes...")
    
    # Run PyInstaller
    try:
        result = subprocess.run(
            [sys.executable, "-m", "PyInstaller", "--clean", "mlx_server.spec"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print("Build failed!")
            print("STDOUT:", result.stdout)
            print("STDERR:", result.stderr)
            return False
        
        # Check if binary was created
        binary_path = Path("dist/mlx-server")
        if not binary_path.exists():
            print("Binary not found after build")
            return False
        
        # Get binary size
        size_mb = binary_path.stat().st_size / (1024 * 1024)
        print(f"\n✅ Build successful!")
        print(f"Binary location: {binary_path.absolute()}")
        print(f"Binary size: {size_mb:.2f} MB")
        
        # Make binary executable
        binary_path.chmod(0o755)
        
        return True
        
    except Exception as e:
        print(f"Build failed with error: {e}")
        return False
    finally:
        # Clean up spec file
        if spec_file.exists():
            spec_file.unlink()


def create_distribution():
    """Create a distribution package."""
    print("\nCreating distribution package...")
    
    dist_dir = Path("mlx-server-dist")
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    
    dist_dir.mkdir()
    
    # Copy binary
    binary_src = Path("dist/mlx-server")
    if binary_src.exists():
        shutil.copy2(binary_src, dist_dir / "mlx-server")
    else:
        print("Binary not found")
        return False
    
    # Create README for distribution
    readme_content = """# MLX Engine Server

## Installation

1. Make sure you have macOS with Apple Silicon (M1/M2/M3)
2. Copy the `mlx-server` binary to a location in your PATH
3. Make it executable: `chmod +x mlx-server`

## Quick Start

```bash
# Start server with default settings
./mlx-server

# Start with a model
./mlx-server --model /path/to/model

# Start on custom port
./mlx-server --port 8080

# Get help
./mlx-server --help
```

## API Documentation

Once the server is running, visit:
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Models

Place your MLX-format models in a directory and load them using:
```bash
curl -X POST http://localhost:8000/v1/mlx/models/load \\
  -H "Content-Type: application/json" \\
  -d '{"model_path": "/path/to/model", "model_id": "my-model"}'
```

## Support

For issues and documentation, visit: https://github.com/yourusername/mlx-engine-server
"""
    
    (dist_dir / "README.md").write_text(readme_content)
    
    # Create example config
    example_config = {
        "host": "127.0.0.1",
        "port": 8000,
        "log_level": "INFO",
        "default_max_tokens": 150,
        "default_temperature": 0.7,
        "max_loaded_models": 1
    }
    
    import json
    (dist_dir / "config.example.json").write_text(json.dumps(example_config, indent=2))
    
    # Create tar.gz archive
    archive_name = f"mlx-server-macos-{platform.machine()}.tar.gz"
    print(f"Creating archive: {archive_name}")
    
    subprocess.run(
        ["tar", "-czf", archive_name, "-C", ".", dist_dir.name],
        check=True
    )
    
    print(f"✅ Distribution package created: {archive_name}")
    
    return True


def main():
    """Main build process."""
    print("🚀 MLX Engine Server Build Script")
    print("=" * 50)
    
    # Check Python version
    if sys.version_info < (3, 9):
        print("Error: Python 3.9+ is required")
        sys.exit(1)
    
    # Build binary
    if not build_binary():
        print("\n❌ Build failed")
        sys.exit(1)
    
    # Create distribution
    if "--dist" in sys.argv:
        if not create_distribution():
            print("\n❌ Distribution creation failed")
            sys.exit(1)
    
    print("\n🎉 Build complete!")
    print("\nTo run the server:")
    print("  ./dist/mlx-server")
    print("\nTo see all options:")
    print("  ./dist/mlx-server --help")


if __name__ == "__main__":
    main()