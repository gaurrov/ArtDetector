"""
auth.py
-------
Verifies Supabase-issued JWTs by calling Supabase's /auth/v1/user endpoint.

This approach works regardless of whether Supabase uses ECC (P-256) or legacy
HS256 signing — we let Supabase itself verify its own token and return the user.

Required env vars (set in .env):
    SUPABASE_URL         e.g. https://abc.supabase.co
    SUPABASE_ANON_KEY    Your project's anon/public key
"""

import os
import logging
from dataclasses import dataclass

import httpx
from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

logger = logging.getLogger("ai_detector.auth")

SUPABASE_URL      = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "").strip()

if not SUPABASE_URL:
    logger.warning("SUPABASE_URL is not set.")
if not SUPABASE_ANON_KEY:
    logger.warning("SUPABASE_ANON_KEY is not set.")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=True)


@dataclass
class SupabaseUser:
    id: str
    email: str | None


def verify_supabase_token(token: str) -> SupabaseUser:
    """
    Verify a Supabase token by calling Supabase's own /auth/v1/user endpoint.
    If Supabase accepts the token, we trust it. No local key needed.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: SUPABASE_URL or SUPABASE_ANON_KEY not set.",
        )

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=10,
        )
    except httpx.RequestError as e:
        logger.error(f"Could not reach Supabase: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach authentication server. Try again shortly.",
        )

    if response.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if response.status_code != 200:
        logger.warning(f"Supabase /auth/v1/user returned {response.status_code}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify your session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    data = response.json()
    user_id = data.get("id")
    email   = data.get("email")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not identify user from token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info(f"Verified user: {email or user_id}")
    return SupabaseUser(id=user_id, email=email)


def get_current_user(token: str = Depends(oauth2_scheme)) -> SupabaseUser:
    """FastAPI dependency — verifies Supabase token and returns the user."""
    return verify_supabase_token(token)