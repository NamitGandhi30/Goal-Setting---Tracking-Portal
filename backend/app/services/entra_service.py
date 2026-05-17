"""Microsoft Entra ID token validation and user provisioning."""

from __future__ import annotations

import uuid

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwk, jwt
from jose.utils import base64url_decode
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.user import User, UserRole


class EntraService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    async def authenticate(self, token: str) -> User:
        claims = await self._validate_token(token)
        email = claims.get("preferred_username") or claims.get("email") or claims.get("upn")
        if not email:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Entra token does not include an email claim")

        employee_id = claims.get("employeeid") or claims.get("employeeId") or email.split("@")[0]
        name = claims.get("name") or email
        department = claims.get("department")
        role = self._role_from_claims(claims)
        manager_id = await self._manager_id_from_claims(claims)

        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                employee_id=str(employee_id),
                name=name,
                email=email,
                role=role,
                manager_id=manager_id,
                department=department,
                hashed_password=hash_password(uuid.uuid4().hex),
            )
            self.db.add(user)
        else:
            user.name = name
            user.role = role
            user.manager_id = manager_id
            user.department = department
            user.is_active = True

        await self.db.flush()
        return user

    async def _validate_token(self, token: str) -> dict:
        if not self.settings.ENTRA_ENABLED:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Microsoft Entra ID login is not enabled")
        if not self.settings.ENTRA_CLIENT_ID or not self.settings.ENTRA_TENANT_ID:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Entra tenant/client settings are missing")

        jwks_url = self.settings.ENTRA_JWKS_URL or (
            f"https://login.microsoftonline.com/{self.settings.ENTRA_TENANT_ID}/discovery/v2.0/keys"
        )
        try:
            headers = jwt.get_unverified_header(token)
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(jwks_url)
                response.raise_for_status()
            key = next((item for item in response.json()["keys"] if item.get("kid") == headers.get("kid")), None)
            if key is None:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No matching Entra signing key found")
            public_key = jwk.construct(key)
            signing_input, encoded_signature = token.rsplit(".", 1)
            decoded_signature = base64url_decode(encoded_signature.encode())
            if not public_key.verify(signing_input.encode(), decoded_signature):
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Entra token signature")
            return jwt.decode(
                token,
                key,
                algorithms=[headers.get("alg", "RS256")],
                audience=self.settings.ENTRA_CLIENT_ID,
                issuer=f"https://login.microsoftonline.com/{self.settings.ENTRA_TENANT_ID}/v2.0",
            )
        except HTTPException:
            raise
        except (JWTError, httpx.HTTPError, KeyError, ValueError) as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Entra token") from exc

    def _role_from_claims(self, claims: dict) -> UserRole:
        roles = set(claims.get("roles") or [])
        groups = set(claims.get("groups") or [])
        if "Admin" in roles or (self.settings.ENTRA_ADMIN_GROUP_ID and self.settings.ENTRA_ADMIN_GROUP_ID in groups):
            return UserRole.ADMIN
        if "Manager" in roles or (self.settings.ENTRA_MANAGER_GROUP_ID and self.settings.ENTRA_MANAGER_GROUP_ID in groups):
            return UserRole.MANAGER
        return UserRole.EMPLOYEE

    async def _manager_id_from_claims(self, claims: dict) -> uuid.UUID | None:
        manager_employee_id = (
            claims.get("manager_employee_id")
            or claims.get("managerEmployeeId")
            or claims.get("extension_managerEmployeeId")
        )
        if not manager_employee_id:
            return None
        result = await self.db.execute(select(User.id).where(User.employee_id == str(manager_employee_id)))
        return result.scalar_one_or_none()
