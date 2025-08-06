#!/usr/bin/env python3
"""Launcher with numpy patch for PyInstaller compatibility."""

import sys
import builtins

# Pre-patch add_docstring before any imports
def safe_add_docstring(obj, doc):
    """Safe version of add_docstring that handles non-string docstrings."""
    if doc is None:
        return
    if not isinstance(doc, str):
        try:
            doc = str(doc)
        except:
            return
    try:
        if hasattr(obj, '__doc__'):
            obj.__doc__ = doc
    except:
        pass

# Install the patch before numpy loads
builtins.add_docstring = safe_add_docstring

# Now import and run the actual application
def main():
    from mlx_engine_server.main import main as app_main
    app_main()

if __name__ == "__main__":
    main()