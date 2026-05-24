# Vercel serverless entrypoint — re-exports the FastAPI app from src/.
#
# Tablet's src/ is a Python package (has __init__.py) and uses relative
# imports like `from .jurisdictions.uk import ...`. So we must import via
# the package path `src.main`, not directly `main`. The PYTHONPATH setting
# in vercel.json puts the repo root on sys.path so `src.main` resolves.
from src.main import app  # noqa: F401  (re-export for Vercel runtime)
