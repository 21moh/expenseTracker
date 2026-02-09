from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.models.user import User
from app.db.database import engine
from app.auth.schemas import UserCreate, UserLogin, Token, UserResponse
from app.auth.utils import get_password_hash, verify_password, create_access_token
from app.auth.dependencies import get_db, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token)
def register(data: UserCreate, session: Session = Depends(get_db)):
    statement = select(User).where(User.email == data.email)
    if session.exec(statement).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token)


@router.post("/login", response_model=Token)
def login(data: UserLogin, session: Session = Depends(get_db)):
    statement = select(User).where(User.email == data.email)
    user = session.exec(statement).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return UserResponse(id=user.id, email=user.email)
