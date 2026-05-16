"""Auth endpoints – login and user registration (mock auth for Phase 1)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password, create_access_token
from app.core.dependencies import CurrentUser
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserOut, UserCreate

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Authenticate user and return JWT token."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    body: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a new user (dev/admin utility – will be replaced by Entra ID sync)."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = User(
        employee_id=body.employee_id,
        name=body.name,
        email=body.email,
        role=body.role,
        manager_id=body.manager_id,
        department=body.department,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser):
    """Get current authenticated user's profile."""
    return UserOut.model_validate(current_user)
