"""Compatibility entrypoint for deployments that still point at api/app.py."""
from app import app

__all__ = ["app"]
