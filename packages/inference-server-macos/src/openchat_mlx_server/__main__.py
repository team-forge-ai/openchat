#!/usr/bin/env python3
"""Entry point for MLX Engine Server when run as a module."""

import sys
from openchat_mlx_server.main import main

if __name__ == "__main__":
    sys.exit(main())