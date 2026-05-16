"""FastAPI dependencies for authentication and RBAC."""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import oauth2_scheme, decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Extract and validate the current user from the JWT token."""
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_role(*roles: UserRole):
    """Dependency factory – restricts endpoint to specific roles."""
    async def _check_role(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {[r.value for r in roles]}",
            )
        return current_user
    return _check_role


# Convenience aliases
CurrentUser = Annotated[User, Depends(get_current_user)]
ManagerOrAdmin = Annotated[User, Depends(require_role(UserRole.MANAGER, UserRole.ADMIN))]
AdminOnly = Annotated[User, Depends(require_role(UserRole.ADMIN))]
