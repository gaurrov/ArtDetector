"""
auth.py
-------
Verifies Supabase-issued JWTs on incoming requests.

Supports both:
- New ECC (P-256) tokens: verified using Supabase's public JWKS endpoint
- Legacy HS256 tokens: verified using SUPABASE_JWT_SECRET env var

Required env vars:
    SUPABASE_URL         e.g. https://abc.supabase.co
    SUPABASE_JWT_SECRET  Legacy JWT secret (fallback for HS256 tokens)
"""

import os
import logging
from dataclasses import dataclass
from functools import lru_cache

import httpx
from dotenv import load_dotenv
load_dotenv()
import jwt as pyjwt
from jwt import PyJWKClient, DecodeError, ExpiredSignatureError, InvalidTokenError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

logger = logging.getLogger("ai_detector.auth")

SUPABASE_URL        = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

if not SUPABASE_URL:
    logger.warning("SUPABASE_URL is not set — ECC token verification will fail.")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=True)


@dataclass
class SupabaseUser:
    id: str
    email: str | None


@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_keys=True)


def _decode_header(token: str) -> dict:
    try:
        return pyjwt.get_unverified_header(token)
    except Exception:
        return {}


def verify_supabase_token(token: str) -> SupabaseUser:
    header = _decode_header(token)
    alg    = header.get("alg", "HS256")
    payload = None

    # ECC (ES256) — new Supabase default
    if alg in ("ES256", "RS256") and SUPABASE_URL:
        try:
            jwks_client = _get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = pyjwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                options={"verify_aud": False},
            )
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            logger.info(f"ECC verification failed, trying HS256 fallback: {e}")

    # HS256 legacy fallback
    if payload is None and SUPABASE_JWT_SECRET:
        try:
            payload = pyjwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except (InvalidTokenError, DecodeError) as e:
            logger.info(f"HS256 verification also failed: {e}")

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing the user identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return SupabaseUser(id=user_id, email=payload.get("email"))


def get_current_user(token: str = Depends(oauth2_scheme)) -> SupabaseUser:
    return verify_supabase_token(token)