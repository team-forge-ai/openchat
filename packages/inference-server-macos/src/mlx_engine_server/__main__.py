#!/usr/bin/env python3
"""Entry point for MLX Engine Server when run as a module."""

import sys
from mlx_engine_server.main import main

if __name__ == "__main__":
    sys.exit(main())