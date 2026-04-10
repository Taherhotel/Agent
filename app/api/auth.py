from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.access_token_exp_minutes)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_admin(email: str, password: str) -> bool:
    return email.lower() == settings.admin_email.lower() and password == settings.admin_password


def get_current_user():
    # Bypass authentication: always return the default admin user
    # Replace this with JWT verification when real user management is needed.
    return {"email": settings.admin_email, "role": "admin"}


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login with admin credentials and receive a JWT access token.
    Username = admin email, Password = admin password (both set in .env).
    """
    if not verify_admin(form_data.username, form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=form_data.username)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    return current_user
