
# This runtime hook is executed by PyInstaller before any other code
import builtins

# === patched runtime hook ===
# Patch add_docstring before and after numpy import
def safe_add_docstring(obj, doc):
    if doc is None:
        return
    if not isinstance(doc, str):
        try:
            doc = str(doc)
        except:
            return
    try:
        obj.__doc__ = doc
    except:
        pass

# Install immediately
builtins.add_docstring = safe_add_docstring
