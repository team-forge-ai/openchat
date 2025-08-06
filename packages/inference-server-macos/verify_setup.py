#!/usr/bin/env python3
"""Verify MLX Engine Server setup and dependencies."""

import sys
import subprocess
from pathlib import Path


def check_python_version():
    """Check Python version."""
    version = sys.version_info
    print(f"✓ Python {version.major}.{version.minor}.{version.micro}")
    if version < (3, 9):
        print("  ⚠️  Python 3.9+ is required")
        return False
    return True


def check_dependency(package_name, import_name=None):
    """Check if a package is installed."""
    if import_name is None:
        import_name = package_name
    
    try:
        __import__(import_name)
        print(f"✓ {package_name} is installed")
        return True
    except ImportError:
        print(f"✗ {package_name} is not installed")
        return False


def check_mlx_compatibility():
    """Check if system is compatible with MLX."""
    import platform
    
    system = platform.system()
    machine = platform.machine()
    
    print(f"\nSystem Information:")
    print(f"  OS: {system}")
    print(f"  Architecture: {machine}")
    
    if system == "Darwin" and machine in ["arm64", "aarch64"]:
        print("  ✓ Apple Silicon detected - MLX compatible")
        return True
    else:
        print("  ⚠️  MLX requires macOS with Apple Silicon (M1/M2/M3)")
        return False


def check_project_structure():
    """Check project structure."""
    print("\nProject Structure:")
    
    required_files = [
        "src/mlx_engine_server/__init__.py",
        "src/mlx_engine_server/main.py",
        "src/mlx_engine_server/server.py",
        "src/mlx_engine_server/model_manager.py",
        "pyproject.toml",
        "requirements.txt",
    ]
    
    all_present = True
    for file_path in required_files:
        if Path(file_path).exists():
            print(f"  ✓ {file_path}")
        else:
            print(f"  ✗ {file_path} missing")
            all_present = False
    
    return all_present


def main():
    """Run all checks."""
    print("=" * 50)
    print("MLX Engine Server - Setup Verification")
    print("=" * 50)
    
    checks_passed = []
    
    # Check Python version
    print("\nPython Version:")
    checks_passed.append(check_python_version())
    
    # Check MLX compatibility
    checks_passed.append(check_mlx_compatibility())
    
    # Check dependencies
    print("\nCore Dependencies:")
    dependencies = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("pydantic", "pydantic"),
        ("psutil", "psutil"),
        ("mlx", "mlx"),
        ("mlx-lm", "mlx_lm"),
        ("transformers", "transformers"),
    ]
    
    for package, import_name in dependencies:
        checks_passed.append(check_dependency(package, import_name))
    
    # Check project structure
    checks_passed.append(check_project_structure())
    
    # Summary
    print("\n" + "=" * 50)
    if all(checks_passed):
        print("✅ All checks passed! The server is ready to run.")
        print("\nNext steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Start the server: python -m mlx_engine_server.main")
        print("3. Load a model and start chatting!")
    else:
        print("⚠️  Some checks failed. Please install missing dependencies.")
        print("\nTo install all dependencies:")
        print("  pip install -r requirements.txt")
        print("\nFor MLX support, ensure you're on macOS with Apple Silicon.")
    
    return 0 if all(checks_passed) else 1


if __name__ == "__main__":
    sys.exit(main())