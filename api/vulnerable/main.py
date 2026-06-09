import hashlib
import hmac
import json
import logging
import math
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional
from urllib.parse import quote_plus, urlparse

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker
from sqlalchemy.pool import StaticPool


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in (
            "request_id",
            "method",
            "path",
            "status_code",
            "duration_ms",
            "client_ip",
            "username",
            "user_id",
            "target_type",
            "target_id",
            "outcome",
            "event",
        ):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"), default=str)


def configure_logging() -> logging.Logger:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        handlers=[handler],
        force=True,
    )
    return logging.getLogger("shield_pdp.api")


logger = configure_logging()


APP_ENV = os.getenv("APP_ENV", "demo").lower()
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ISSUER = os.getenv("JWT_ISSUER", "shield-pdp")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "480"))
PBKDF2_ITERATIONS = int(os.getenv("PBKDF2_ITERATIONS", "210000"))
STARTED_AT = time.time()
ENABLE_VULNERABLE_DEMO = os.getenv("ENABLE_VULNERABLE_DEMO", "true").lower() == "true"


def read_secret(name: str, file_name: str) -> Optional[str]:
    value = os.getenv(name)
    if value:
        return value
    secret_file = os.getenv(file_name)
    if not secret_file:
        return None
    with open(secret_file, "r", encoding="utf-8") as handle:
        return handle.read().strip()


SECRET_KEY = read_secret("SECRET_KEY", "SECRET_KEY_FILE")
if not SECRET_KEY:
    if APP_ENV in {"demo", "dev", "development", "local", "test"}:
        SECRET_KEY = secrets.token_urlsafe(48)
        logger.warning(
            "Generated ephemeral JWT signing key; set SECRET_KEY for stable sessions.",
            extra={"event": "config_ephemeral_secret"},
        )
    else:
        raise RuntimeError("SECRET_KEY or SECRET_KEY_FILE must be configured outside demo mode.")
elif len(SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY must be at least 32 characters.")


def build_database_url() -> str:
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url

    db_driver = os.getenv("DB_DRIVER", "postgresql+psycopg2")
    db_user = quote_plus(os.getenv("DB_USER", "shield"))
    db_password = quote_plus(read_secret("DB_PASSWORD", "DB_PASSWORD_FILE") or "shield_demo_password")
    db_host = os.getenv("DB_HOST", "db")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = quote_plus(os.getenv("DB_NAME", "shield_pdp_db"))
    return f"{db_driver}://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


DATABASE_URL = build_database_url()
engine_options = {"pool_pre_ping": True, "future": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
    if DATABASE_URL in {"sqlite://", "sqlite:///:memory:"}:
        engine_options["poolclass"] = StaticPool
else:
    engine_options["pool_size"] = int(os.getenv("DB_POOL_SIZE", "5"))
    engine_options["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", "10"))

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    role_name = Column("role", String(32), default="customer", nullable=True)
    customer_id = Column(String(64), unique=True, index=True, nullable=True)
    is_admin = Column(Integer, default=0, nullable=False)
    is_active = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="owner", cascade="all, delete-orphan")

    @property
    def role(self) -> str:
        if self.role_name:
            return self.role_name
        return "admin" if self.is_admin else "customer"


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    profile_id = Column(String(64), unique=True, index=True, nullable=True)
    customer_id = Column(String(64), index=True, nullable=True)
    full_name = Column(String(128), nullable=False)
    nik = Column(String(32), nullable=False)
    biometric_sample = Column(Text, nullable=True)
    email = Column(String(254), nullable=False)
    phone = Column(String(32), nullable=False)
    user = relationship("User", back_populates="profile")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    account_id = Column(String(64), unique=True, index=True, nullable=True)
    account_number = Column(String(32), unique=True, index=True, nullable=False)
    balance = Column(Float, default=0.0, nullable=False)
    currency = Column(String(8), default="IDR", nullable=True)
    account_type = Column(String(64), default="Primary Wallet", nullable=True)
    account_name = Column(String(128), nullable=True)
    bank_name = Column(String(128), default="Dana Sejahtera Wallet", nullable=True)
    status = Column(String(32), default="active", nullable=True)
    classification = Column(String(64), default="Confidential", nullable=True)
    last_activity_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=True)
    owner = relationship("User", back_populates="accounts")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), index=True, nullable=False)
    transaction_id = Column(String(64), unique=True, index=True, nullable=True)
    transaction_ref = Column(String(64), unique=True, index=True, nullable=False)
    amount = Column(Float, default=0.0, nullable=False)
    currency = Column(String(8), default="IDR", nullable=False)
    direction = Column(String(16), nullable=False)
    status = Column(String(32), default="settled", nullable=False)
    merchant = Column(String(128), nullable=True)
    category = Column(String(128), nullable=True)
    channel = Column(String(64), nullable=True)
    risk = Column(String(32), default="low", nullable=True)
    risk_score = Column(Integer, default=0, nullable=True)
    suspicious_reason = Column(Text, nullable=True)
    transfer_id = Column(String(64), index=True, nullable=True)
    counterparty = Column(String(128), nullable=True)
    note = Column(Text, nullable=True)
    occurred_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    account = relationship("Account")


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(String(64), unique=True, index=True, nullable=False)
    authenticated_user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    source_account_id = Column(String(64), index=True, nullable=False)
    destination_account_id = Column(String(64), index=True, nullable=False)
    amount = Column(Float, default=0.0, nullable=False)
    currency = Column(String(8), default="IDR", nullable=False)
    note = Column(Text, nullable=True)
    simulation_only = Column(Integer, default=1, nullable=False)
    status = Column(String(32), default="simulated", nullable=False)
    risk = Column(String(32), default="high", nullable=False)
    source_owner_id = Column(Integer, nullable=True)
    initiated_by_username = Column(String(64), nullable=True)
    source_owner_customer_id = Column(String(64), nullable=True)
    destination_owner_customer_id = Column(String(64), nullable=True)
    vulnerable_mode = Column(Integer, default=1, nullable=False)
    idor_detected = Column(Integer, default=0, nullable=False)
    source_transaction_id = Column(String(64), nullable=True)
    destination_transaction_id = Column(String(64), nullable=True)
    source_balance_before = Column(Float, nullable=True)
    source_balance_after = Column(Float, nullable=True)
    destination_balance_before = Column(Float, nullable=True)
    destination_balance_after = Column(Float, nullable=True)
    idempotency_key = Column(String(128), index=True, nullable=True)
    evidence_id = Column(String(64), nullable=True)
    audit_event_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    audit_event_id = Column(String(64), unique=True, index=True, nullable=True)
    event_type = Column(String(64), index=True, nullable=False)
    actor_user_id = Column(Integer, nullable=True)
    actor_username = Column(String(64), nullable=True)
    actor_role = Column(String(32), nullable=True)
    action = Column(String(128), nullable=True)
    method = Column(String(16), nullable=True)
    path = Column(String(256), nullable=True)
    target_type = Column(String(64), nullable=True)
    target_id = Column(String(64), nullable=True)
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(String(128), nullable=True)
    target_owner_id = Column(String(64), nullable=True)
    authenticated_owner_id = Column(String(64), nullable=True)
    outcome = Column(String(32), nullable=False)
    result = Column(String(32), nullable=True)
    status_code = Column(Integer, nullable=True)
    risk = Column(String(32), nullable=True)
    pdp_relevant = Column(Integer, default=0, nullable=True)
    personal_data_accessed = Column(Integer, default=0, nullable=True)
    request_id = Column(String(64), index=True, nullable=True)
    correlation_id = Column(String(64), index=True, nullable=True)
    user_agent = Column(Text, nullable=True)
    source_ip = Column(String(64), nullable=True)
    ip_address = Column(String(64), nullable=True)
    evidence_id = Column(String(64), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class PentestEvidence(Base):
    __tablename__ = "pentest_evidence"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(String(64), unique=True, index=True, nullable=False)
    finding_id = Column(String(64), index=True, nullable=False)
    vulnerability_type = Column(String(128), nullable=False)
    severity = Column(String(32), nullable=False)
    cvss = Column(Float, default=0.0, nullable=False)
    affected_endpoint = Column(String(256), nullable=False)
    affected_object = Column(String(128), nullable=True)
    authenticated_user = Column(String(64), nullable=True)
    target_owner = Column(String(64), nullable=True)
    business_impact = Column(Text, nullable=False)
    pdp_impact = Column(Text, nullable=False)
    request_summary = Column(Text, nullable=False)
    response_summary = Column(Text, nullable=False)
    remediation = Column(Text, nullable=False)
    status = Column(String(32), default="open", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class SegmentationEvidence(Base):
    __tablename__ = "segmentation_evidence"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(String(64), unique=True, index=True, nullable=False)
    db_zone = Column(String(128), nullable=False)
    app_zone = Column(String(128), nullable=False)
    database_host = Column(String(64), nullable=False)
    allowed_client = Column(String(64), nullable=False)
    transport = Column(String(64), nullable=False)
    postgres_listen_policy = Column(Text, nullable=False)
    public_listen = Column(Integer, default=0, nullable=False)
    firewall_policy = Column(Text, nullable=False)
    segmentation_status = Column(String(32), nullable=False)
    risk = Column(String(32), nullable=False)
    pdp_impact = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
    user: dict
    role: str
    customerId: Optional[str] = None
    profileId: Optional[str] = None
    accountIds: List[str] = []


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    customer_id: Optional[str] = None
    is_active: int


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    profile_id: Optional[str] = None
    customer_id: Optional[str] = None
    full_name: str
    nik: str
    email: str
    phone: str


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: Optional[str] = None
    account_number: str
    balance: float


class TransferRequest(BaseModel):
    sourceAccountId: str = Field(min_length=1)
    destinationAccountId: str = Field(min_length=1)
    amount: float = Field(gt=0)
    note: Optional[str] = None
    idempotencyKey: Optional[str] = Field(default=None, max_length=128)


class IDORProfileLeakOut(BaseModel):
    vulnerability: str
    exploit_status: str
    attacker_username: str
    requested_user_id: int
    leaked_username: str
    leaked_full_name: str
    leaked_nik: str
    leaked_biometric_sample: Optional[str]
    leaked_email: str
    leaked_phone: str
    evidence: str


class BOLAAccountLeakOut(BaseModel):
    vulnerability: str
    exploit_status: str
    attacker_username: str
    requested_account_id: int
    leaked_owner_username: str
    leaked_owner_user_id: int
    leaked_account_number: str
    leaked_balance: float
    evidence: str


class DashboardSummary(BaseModel):
    risk_score: int
    compliance_score: int
    active_incidents: int
    protected_records: int
    services: dict
    controls: List[dict]
    incidents: List[dict]


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    actor_username: Optional[str]
    target_type: Optional[str]
    target_id: Optional[str]
    outcome: str
    request_id: Optional[str]
    created_at: datetime


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
LOGIN_FAILURES: dict[str, list[float]] = {}
REQUEST_COUNT = 0
ERROR_COUNT = 0
AUTH_FAILURE_COUNT = 0


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            logger.warning("Unsupported password hash format.", extra={"event": "auth_unsupported_hash"})
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        ).hex()
        return hmac.compare_digest(actual, expected)
    except (AttributeError, ValueError):
        logger.warning("Malformed password hash encountered.", extra={"event": "auth_malformed_hash"})
        return False


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


def create_token(user: User, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role,
        "type": token_type,
        "iss": JWT_ISSUER,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if payload.get("iss") != JWT_ISSUER or payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    global AUTH_FAILURE_COUNT
    payload = decode_token(token, "access")
    username = payload.get("sub")
    user_id = payload.get("user_id")
    if not username or not user_id:
        AUTH_FAILURE_COUNT += 1
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    user = db.query(User).filter(User.id == user_id, User.username == username).first()
    if not user or not user.is_active:
        AUTH_FAILURE_COUNT += 1
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive or missing")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


def enforce_user_access(current_user: User, target_user_id: int) -> None:
    if current_user.role == "admin" or current_user.id == target_user_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Object access denied")


def is_privileged_evidence_viewer(user: User) -> bool:
    return user.role in {"admin", "auditor", "pentester"}


def request_path(request: Request) -> str:
    return request.url.path


def canonical_endpoint(request: Request, secure: bool = False) -> str:
    path = request.url.path
    if path.startswith("/secure/"):
        return f"/api/v1/secure/{path.removeprefix('/secure/')}"
    if path.startswith("/pentest/"):
        return f"/api/v1/pentest/{path.removeprefix('/pentest/')}"
    prefix = "/api/v1/secure" if secure else "/api/v1/vulnerable"
    return f"{prefix}{path}"


def mask_account_number(account_number: str) -> str:
    raw = str(account_number or "")
    if len(raw) <= 4:
        return "****"
    return f"{raw[:4]}-****-****-{raw[-4:]}"


def account_ref(account: Account) -> str:
    return account.account_id or account.account_number or str(account.id)


def transaction_ref(transaction: Transaction) -> str:
    return transaction.transaction_id or transaction.transaction_ref or str(transaction.id)


def user_owner_ref(user: Optional[User]) -> str:
    if not user:
        return "unknown"
    return user.customer_id or user.username


def user_auth_payload(user: User) -> dict[str, Any]:
    profile = user.profile
    account_ids = [account_ref(account) for account in user.accounts]
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "customerId": user.customer_id,
        "profileId": profile.profile_id if profile else None,
        "accountIds": account_ids,
    }


def account_to_payload(account: Account, authenticated_user: Optional[User] = None) -> dict[str, Any]:
    owner = account.owner
    owner_ref = user_owner_ref(owner)
    authenticated_owner = user_owner_ref(authenticated_user)
    return {
        "id": account_ref(account),
        "accountId": account_ref(account),
        "ownerId": owner_ref,
        "ownerUsername": owner.username if owner else None,
        "ownerCustomerId": owner.customer_id if owner else None,
        "type": account.account_type or "Primary Wallet",
        "name": account.account_name or "Dana Sejahtera Wallet",
        "maskedNumber": mask_account_number(account.account_number),
        "accountNumberMasked": mask_account_number(account.account_number),
        "bank": account.bank_name or "Dana Sejahtera Wallet",
        "status": account.status or "active",
        "balance": float(account.balance or 0),
        "currency": account.currency or "IDR",
        "classification": account.classification or "Confidential",
        "lastActivity": (account.last_activity_at or account.owner.created_at if account.owner else datetime.now(timezone.utc)).isoformat(),
        "updatedAt": (account.updated_at or account.last_activity_at or datetime.now(timezone.utc)).isoformat(),
        "metadata": {
            "authenticatedOwnerId": authenticated_owner,
            "targetOwnerId": owner_ref,
            "crossOwner": bool(authenticated_user and owner and authenticated_user.id != owner.id),
            "labEndpoint": "vulnerable",
        },
    }


def transaction_to_payload(transaction: Transaction, authenticated_user: Optional[User] = None) -> dict[str, Any]:
    account = transaction.account
    owner = account.owner if account else None
    owner_ref = user_owner_ref(owner)
    authenticated_owner = user_owner_ref(authenticated_user)
    direction = "in" if transaction.direction == "credit" else "out"
    status_value = transaction.status or "settled"
    if status_value == "posted":
        status_value = "settled"
    occurred_at = transaction.occurred_at or transaction.created_at
    return {
        "id": transaction_ref(transaction),
        "transactionId": transaction_ref(transaction),
        "transferId": transaction.transfer_id,
        "accountId": account_ref(account) if account else None,
        "ownerId": owner_ref,
        "ownerUsername": owner.username if owner else None,
        "merchant": transaction.merchant or transaction.counterparty or "Synthetic transaction",
        "counterparty": transaction.counterparty,
        "category": transaction.category or "Transfer",
        "amount": float(transaction.amount or 0),
        "currency": transaction.currency or "IDR",
        "direction": direction,
        "status": status_value,
        "occurredAt": occurred_at.isoformat(),
        "channel": transaction.channel or "Wallet",
        "risk": transaction.risk or "low",
        "note": transaction.note,
        "suspiciousReason": transaction.suspicious_reason,
        "metadata": {
            "authenticatedOwnerId": authenticated_owner,
            "targetOwnerId": owner_ref,
            "crossOwner": bool(authenticated_user and owner and authenticated_user.id != owner.id),
            "labEndpoint": "vulnerable",
        },
    }


def account_lookup_filter(account_id: str):
    if account_id.isdigit():
        return (Account.id == int(account_id)) | (Account.account_id == account_id) | (Account.account_number == account_id)
    return (Account.account_id == account_id) | (Account.account_number == account_id)


def get_account_by_any_id(db: Session, account_id: str) -> Optional[Account]:
    return db.query(Account).filter(account_lookup_filter(account_id)).first()


def get_account_by_any_id_for_update(db: Session, account_id: str) -> Optional[Account]:
    return db.query(Account).filter(account_lookup_filter(account_id)).with_for_update().first()


def get_transaction_by_any_id(db: Session, transaction_id: str) -> Optional[Transaction]:
    query = db.query(Transaction)
    if transaction_id.isdigit():
        return query.filter(Transaction.id == int(transaction_id)).first()
    return query.filter((Transaction.transaction_id == transaction_id) | (Transaction.transaction_ref == transaction_id)).first()


def record_audit_event(
    db: Session,
    request: Request,
    event_type: str,
    outcome: str,
    actor: Optional[User] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[dict] = None,
    commit: bool = True,
    raise_on_error: bool = False,
) -> str:
    request_id = getattr(request.state, "request_id", None)
    details = details or {}
    audit_event_id = details.get("auditEventId") or f"AUD-{uuid.uuid4().hex[:12].upper()}"
    action = details.get("action") or event_type
    result = details.get("result") or outcome
    status_code = details.get("statusCode")
    source = client_ip(request)
    logger.info(
        "Audit event recorded.",
        extra={
            "event": event_type,
            "request_id": request_id,
            "username": actor.username if actor else None,
            "user_id": actor.id if actor else None,
            "target_type": target_type,
            "target_id": target_id,
            "outcome": outcome,
            "client_ip": client_ip(request),
        },
    )
    try:
        payload = AuditEvent(
            audit_event_id=audit_event_id,
            event_type=event_type,
            actor_user_id=actor.id if actor else None,
            actor_username=actor.username if actor else None,
            actor_role=actor.role if actor else None,
            action=action,
            method=request.method,
            path=request_path(request),
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            resource_type=details.get("resourceType") or target_type,
            resource_id=str(details.get("resourceId") or target_id or "") or None,
            target_owner_id=details.get("targetOwnerId"),
            authenticated_owner_id=details.get("authenticatedOwnerId"),
            outcome=outcome,
            result=result,
            status_code=int(status_code) if status_code is not None else None,
            risk=details.get("risk"),
            pdp_relevant=1 if details.get("pdpRelevant") else 0,
            personal_data_accessed=1 if details.get("personalDataAccessed") else 0,
            request_id=request_id,
            correlation_id=request_id,
            user_agent=request.headers.get("user-agent"),
            source_ip=source,
            ip_address=source,
            evidence_id=details.get("evidenceId"),
            details=json.dumps(details, separators=(",", ":"), default=str),
        )
        db.add(payload)
        if commit:
            db.commit()
        else:
            db.flush()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Failed to persist audit event.", extra={"event": "audit_persist_failed"})
        if raise_on_error:
            raise exc
    return audit_event_id


def create_pentest_evidence(
    db: Session,
    *,
    finding_id: str,
    vulnerability_type: str,
    severity: str,
    cvss: float,
    affected_endpoint: str,
    affected_object: str,
    authenticated_user: Optional[User],
    target_owner: Optional[User],
    business_impact: str,
    pdp_impact: str,
    request_summary: str,
    response_summary: str,
    remediation: str,
    evidence_id: Optional[str] = None,
    status_value: str = "open",
    commit: bool = True,
    raise_on_error: bool = False,
) -> str:
    evidence_id = evidence_id or f"EVD-{uuid.uuid4().hex[:12].upper()}"
    existing = db.query(PentestEvidence).filter(PentestEvidence.evidence_id == evidence_id).first()
    if existing:
        return existing.evidence_id
    try:
        db.add(
            PentestEvidence(
                evidence_id=evidence_id,
                finding_id=finding_id,
                vulnerability_type=vulnerability_type,
                severity=severity,
                cvss=cvss,
                affected_endpoint=affected_endpoint,
                affected_object=affected_object,
                authenticated_user=authenticated_user.username if authenticated_user else None,
                target_owner=user_owner_ref(target_owner),
                business_impact=business_impact,
                pdp_impact=pdp_impact,
                request_summary=request_summary,
                response_summary=response_summary,
                remediation=remediation,
                status=status_value,
            )
        )
        if commit:
            db.commit()
        else:
            db.flush()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Failed to persist pentest evidence.", extra={"event": "evidence_persist_failed"})
        if raise_on_error:
            raise exc
    return evidence_id


def evidence_to_payload(evidence: PentestEvidence) -> dict[str, Any]:
    return {
        "evidenceId": evidence.evidence_id,
        "findingId": evidence.finding_id,
        "vulnerabilityType": evidence.vulnerability_type,
        "severity": evidence.severity,
        "cvss": evidence.cvss,
        "affectedEndpoint": evidence.affected_endpoint,
        "affectedObject": evidence.affected_object,
        "authenticatedUser": evidence.authenticated_user,
        "targetOwner": evidence.target_owner,
        "businessImpact": evidence.business_impact,
        "pdpImpact": evidence.pdp_impact,
        "requestSummary": evidence.request_summary,
        "responseSummary": evidence.response_summary,
        "remediation": evidence.remediation,
        "status": evidence.status,
        "createdAt": evidence.created_at.isoformat(),
    }


def evidence_to_finding(evidence: PentestEvidence) -> dict[str, Any]:
    return {
        "id": evidence.finding_id,
        "title": evidence.vulnerability_type,
        "severity": evidence.severity,
        "cvss": evidence.cvss,
        "affectedAsset": evidence.affected_object or "Shield-PDP fintech API",
        "affectedEndpoint": evidence.affected_endpoint,
        "affectedData": "Synthetic account, transaction, transfer, audit, or segmentation metadata",
        "businessImpact": evidence.business_impact,
        "pdpImpact": evidence.pdp_impact,
        "reproductionSummary": evidence.request_summary,
        "evidence": [
            f"Evidence ID {evidence.evidence_id}",
            evidence.response_summary,
            "All records are synthetic and generated inside the authorized Shield-PDP lab.",
        ],
        "remediation": evidence.remediation,
        "status": evidence.status,
    }


def audit_to_payload(event: AuditEvent) -> dict[str, Any]:
    return {
        "auditEventId": event.audit_event_id or f"AUD-{event.id}",
        "id": event.id,
        "actorUserId": event.actor_user_id,
        "actorUsername": event.actor_username,
        "actorRole": event.actor_role,
        "action": event.action or event.event_type,
        "event_type": event.event_type,
        "method": event.method,
        "path": event.path,
        "resourceType": event.resource_type or event.target_type,
        "resourceId": event.resource_id or event.target_id,
        "targetOwnerId": event.target_owner_id,
        "authenticatedOwnerId": event.authenticated_owner_id,
        "result": event.result or event.outcome,
        "outcome": event.outcome,
        "statusCode": event.status_code,
        "risk": event.risk,
        "pdpRelevant": bool(event.pdp_relevant),
        "personalDataAccessed": bool(event.personal_data_accessed),
        "timestamp": event.created_at.isoformat(),
        "created_at": event.created_at.isoformat(),
        "correlationId": event.correlation_id or event.request_id,
        "request_id": event.request_id,
        "userAgent": event.user_agent,
        "sourceIp": event.source_ip or event.ip_address,
        "target_type": event.target_type,
        "target_id": event.target_id,
        "actor_username": event.actor_username,
        "evidenceId": event.evidence_id,
    }


def check_login_rate_limit(key: str) -> None:
    now = time.time()
    window_seconds = int(os.getenv("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "300"))
    max_failures = int(os.getenv("LOGIN_RATE_LIMIT_FAILURES", "5"))
    recent_failures = [timestamp for timestamp in LOGIN_FAILURES.get(key, []) if now - timestamp < window_seconds]
    LOGIN_FAILURES[key] = recent_failures
    if len(recent_failures) >= max_failures:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many failed login attempts")


def register_login_failure(key: str) -> None:
    LOGIN_FAILURES.setdefault(key, []).append(time.time())


def clear_login_failures(key: str) -> None:
    LOGIN_FAILURES.pop(key, None)


app = FastAPI(title="Shield-PDP Security API", version="1.0.0")
cors_origins = [origin.strip() for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if origin.strip()]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Idempotency-Key", "X-Request-ID"],
    )


@app.middleware("http")
async def request_middleware(request: Request, call_next):
    global REQUEST_COUNT, ERROR_COUNT
    REQUEST_COUNT += 1
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    request.state.request_id = request_id
    start_time = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        ERROR_COUNT += 1
        logger.exception(
            "Unhandled request failure.",
            extra={
                "event": "request_unhandled_exception",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": client_ip(request),
            },
        )
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error", "request_id": request_id},
        )
    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if response.status_code >= 500:
        ERROR_COUNT += 1
    logger.info(
        "Request completed.",
        extra={
            "event": "request_completed",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "client_ip": client_ip(request),
        },
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": getattr(request.state, "request_id", None)},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "request_id": getattr(request.state, "request_id", None)},
    )


def wait_for_database() -> None:
    attempts = int(os.getenv("DB_STARTUP_ATTEMPTS", "20"))
    delay_seconds = float(os.getenv("DB_STARTUP_DELAY_SECONDS", "2"))
    for attempt in range(1, attempts + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            logger.info("Database connection ready.", extra={"event": "database_ready"})
            return
        except SQLAlchemyError as exc:
            logger.warning(
                "Database not ready.",
                extra={"event": "database_wait", "outcome": f"attempt_{attempt}"},
            )
            if attempt == attempts:
                raise RuntimeError("Database failed readiness checks.") from exc
            time.sleep(delay_seconds)


def database_name() -> str:
    if DATABASE_URL.startswith("sqlite"):
        return "sqlite-lab"
    parsed = urlparse(DATABASE_URL)
    return (parsed.path or "").lstrip("/") or os.getenv("DB_NAME", "shield_pdp")


def database_host() -> str:
    if DATABASE_URL.startswith("sqlite"):
        return "local-sqlite"
    parsed = urlparse(DATABASE_URL)
    return parsed.hostname or os.getenv("DB_HOST", "100.110.198.103")


def add_column_if_missing(connection, table_name: str, column_name: str, column_definition: str) -> None:
    inspector = inspect(connection)
    if not inspector.has_table(table_name):
        return
    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name not in existing_columns:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"))


def ensure_database_schema() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        additions = {
            "users": [
                ("role", "VARCHAR(32)"),
                ("customer_id", "VARCHAR(64)"),
            ],
            "profiles": [
                ("profile_id", "VARCHAR(64)"),
                ("customer_id", "VARCHAR(64)"),
            ],
            "accounts": [
                ("account_id", "VARCHAR(64)"),
                ("currency", "VARCHAR(8)"),
                ("account_type", "VARCHAR(64)"),
                ("account_name", "VARCHAR(128)"),
                ("bank_name", "VARCHAR(128)"),
                ("status", "VARCHAR(32)"),
                ("classification", "VARCHAR(64)"),
                ("last_activity_at", "TIMESTAMPTZ"),
                ("updated_at", "TIMESTAMPTZ"),
            ],
            "transactions": [
                ("transaction_id", "VARCHAR(64)"),
                ("category", "VARCHAR(128)"),
                ("channel", "VARCHAR(64)"),
                ("risk", "VARCHAR(32)"),
                ("suspicious_reason", "TEXT"),
                ("transfer_id", "VARCHAR(64)"),
                ("counterparty", "VARCHAR(128)"),
                ("note", "TEXT"),
                ("occurred_at", "TIMESTAMPTZ"),
            ],
            "transfers": [
                ("initiated_by_username", "VARCHAR(64)"),
                ("source_owner_customer_id", "VARCHAR(64)"),
                ("destination_owner_customer_id", "VARCHAR(64)"),
                ("vulnerable_mode", "INTEGER DEFAULT 1"),
                ("idor_detected", "INTEGER DEFAULT 0"),
                ("source_transaction_id", "VARCHAR(64)"),
                ("destination_transaction_id", "VARCHAR(64)"),
                ("source_balance_before", "DOUBLE PRECISION"),
                ("source_balance_after", "DOUBLE PRECISION"),
                ("destination_balance_before", "DOUBLE PRECISION"),
                ("destination_balance_after", "DOUBLE PRECISION"),
                ("idempotency_key", "VARCHAR(128)"),
            ],
            "audit_events": [
                ("audit_event_id", "VARCHAR(64)"),
                ("actor_role", "VARCHAR(32)"),
                ("action", "VARCHAR(128)"),
                ("method", "VARCHAR(16)"),
                ("path", "VARCHAR(256)"),
                ("resource_type", "VARCHAR(64)"),
                ("resource_id", "VARCHAR(128)"),
                ("target_owner_id", "VARCHAR(64)"),
                ("authenticated_owner_id", "VARCHAR(64)"),
                ("result", "VARCHAR(32)"),
                ("status_code", "INTEGER"),
                ("risk", "VARCHAR(32)"),
                ("pdp_relevant", "INTEGER"),
                ("personal_data_accessed", "INTEGER"),
                ("correlation_id", "VARCHAR(64)"),
                ("user_agent", "TEXT"),
                ("source_ip", "VARCHAR(64)"),
                ("evidence_id", "VARCHAR(64)"),
            ],
        }
        for table_name, columns in additions.items():
            for column_name, column_definition in columns:
                add_column_if_missing(connection, table_name, column_name, column_definition)
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_users_customer_id ON users (customer_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_profiles_profile_id ON profiles (profile_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_accounts_account_id ON accounts (account_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_transactions_transaction_id ON transactions (transaction_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_transactions_transfer_id ON transactions (transfer_id)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_transfers_idempotency_key ON transfers (idempotency_key) WHERE idempotency_key IS NOT NULL"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_events_audit_event_id ON audit_events (audit_event_id)"))


def upsert_user(
    db: Session,
    username: str,
    password: str,
    role: str,
    profile: dict,
    account: Optional[dict] = None,
) -> User:
    user = db.query(User).filter(User.username == username).first()
    is_admin = role == "admin"
    if not user:
        user = User(
            username=username,
            hashed_password=hash_password(password),
            is_admin=1 if is_admin else 0,
            role_name=role,
            customer_id=profile.get("customer_id"),
        )
        db.add(user)
        db.flush()
    else:
        user.is_admin = 1 if is_admin else 0
        user.is_active = 1
        user.role_name = role
        user.customer_id = profile.get("customer_id")
        if not user.hashed_password.startswith("pbkdf2_sha256$") or os.getenv("RESET_DEMO_PASSWORDS") == "true":
            user.hashed_password = hash_password(password)

    profile_data = profile.copy()
    customer_id = profile_data.pop("customer_id", None)
    existing_profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if existing_profile:
        existing_profile.customer_id = customer_id
        for key, value in profile_data.items():
            setattr(existing_profile, key, value)
    else:
        db.add(Profile(user_id=user.id, customer_id=customer_id, **profile_data))

    if account:
        account_external_id = account.get("account_id")
        existing_account = None
        if account_external_id:
            existing_account = db.query(Account).filter(Account.account_id == account_external_id).first()
        if not existing_account:
            existing_account = db.query(Account).filter(Account.account_number == account["account_number"]).first()
        if existing_account:
            existing_account.owner_id = user.id
            for key, value in account.items():
                if key == "balance" and os.getenv("RESET_DEMO_BALANCES", "false").lower() != "true":
                    continue
                setattr(existing_account, key, value)
        else:
            db.add(Account(owner_id=user.id, **account))
    return user


def upsert_transaction(db: Session, account: Account, payload: dict[str, Any]) -> None:
    existing = db.query(Transaction).filter(Transaction.transaction_id == payload["transaction_id"]).first()
    if not existing:
        existing = db.query(Transaction).filter(Transaction.transaction_ref == payload["transaction_ref"]).first()
    if existing:
        existing.account_id = account.id
        for key, value in payload.items():
            setattr(existing, key, value)
    else:
        db.add(Transaction(account_id=account.id, **payload))


def upsert_segmentation_evidence(db: Session) -> None:
    evidence_id = "EVD-SEG-REMOTE-DB-001"
    existing = db.query(SegmentationEvidence).filter(SegmentationEvidence.evidence_id == evidence_id).first()
    payload = {
        "db_zone": "shield-db:on-prem-personal-data-zone",
        "app_zone": "shield-cloud:web-api-zone",
        "database_host": "100.110.198.103",
        "allowed_client": "100.119.241.7",
        "transport": "Tailscale",
        "postgres_listen_policy": "127.0.0.1 and Tailscale IP only",
        "public_listen": 0,
        "firewall_policy": "5432 allowed only from shield-cloud over tailscale0",
        "segmentation_status": "enforced",
        "risk": "low",
        "pdp_impact": "Positive evidence: database containing personal data is isolated from public network exposure.",
    }
    if existing:
        for key, value in payload.items():
            setattr(existing, key, value)
    else:
        db.add(SegmentationEvidence(evidence_id=evidence_id, **payload))


def seed_database() -> None:
    seed_users = [
        {
            "username": "alice",
            "password": "password123",
            "role": "customer",
            "profile": {
                "customer_id": "CUST-ALICE",
                "profile_id": "PROF-ALICE",
                "full_name": "Alice Smith",
                "nik": "3171012345670001",
                "biometric_sample": "sha256:f4b7-demo-alice",
                "email": "alice@example.com",
                "phone": "+62-812-0000-0001",
            },
            "account": {"account_id": "ACC-1001", "account_number": "ACC-1001", "balance": 5000.0, "currency": "IDR"},
        },
        {
            "username": "bob",
            "password": "password123",
            "role": "customer",
            "profile": {
                "customer_id": "CUST-BOB",
                "profile_id": "PROF-BOB",
                "full_name": "Bob Santoso",
                "nik": "3171012345670002",
                "biometric_sample": "sha256:9a81-demo-bob",
                "email": "bob@example.com",
                "phone": "+62-812-0000-0002",
            },
            "account": {"account_id": "ACC-1002", "account_number": "ACC-1002", "balance": 12500.0, "currency": "IDR"},
        },
        {
            "username": "charlie",
            "password": "password123",
            "role": "customer",
            "profile": {
                "customer_id": "CUST-CHARLIE",
                "profile_id": "PROF-CHARLIE",
                "full_name": "Charlie Wijaya",
                "nik": "3171012345670003",
                "biometric_sample": "sha256:29be-demo-charlie",
                "email": "charlie@example.com",
                "phone": "+62-812-0000-0003",
            },
            "account": {"account_id": "ACC-1003", "account_number": "ACC-1003", "balance": 250.0, "currency": "IDR"},
        },
        {
            "username": "budi",
            "password": "password123",
            "role": "customer",
            "profile": {
                "customer_id": "CUST-BUDI",
                "profile_id": "PROF-BUDI",
                "full_name": "Budi Santoso",
                "nik": "3273010101010001",
                "biometric_sample": "sha256:synthetic-budi",
                "email": "budi.santoso@example.test",
                "phone": "+62-812-1000-0001",
            },
            "account": {
                "account_id": "ACC-BUDI-001",
                "account_number": "880012340001",
                "balance": 48275000.0,
                "currency": "IDR",
                "account_type": "Primary Wallet",
                "account_name": "Budi Shield Wallet",
                "bank_name": "Dana Sejahtera Wallet",
                "status": "active",
                "classification": "Confidential",
                "last_activity_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        },
        {
            "username": "maya",
            "password": "password123",
            "role": "customer",
            "profile": {
                "customer_id": "CUST-MAYA",
                "profile_id": "PROF-MAYA",
                "full_name": "Maya Kusuma",
                "nik": "3273020202020002",
                "biometric_sample": "sha256:synthetic-maya",
                "email": "maya.kusuma@example.test",
                "phone": "+62-812-1000-0002",
            },
            "account": {
                "account_id": "ACC-MAYA-001",
                "account_number": "880012340002",
                "balance": 36750000.0,
                "currency": "IDR",
                "account_type": "Primary Wallet",
                "account_name": "Maya Shield Wallet",
                "bank_name": "Dana Sejahtera Wallet",
                "status": "active",
                "classification": "Confidential",
                "last_activity_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        },
        {
            "username": "nadia",
            "password": "password123",
            "role": "customer",
            "profile": {
                "customer_id": "CUST-NADIA",
                "profile_id": "PROF-NADIA",
                "full_name": "Nadia Prameswari",
                "nik": "3273030303030003",
                "biometric_sample": "sha256:synthetic-nadia",
                "email": "nadia.prameswari@example.test",
                "phone": "+62-812-1000-0003",
            },
            "account": {
                "account_id": "ACC-NADIA-001",
                "account_number": "880012340003",
                "balance": 7500000.0,
                "currency": "IDR",
                "account_type": "Primary Wallet",
                "account_name": "Nadia Shield Wallet",
                "bank_name": "Dana Sejahtera Wallet",
                "status": "active",
                "classification": "Confidential",
                "last_activity_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        },
        {
            "username": "admin",
            "password": "admin12345",
            "role": "admin",
            "profile": {
                "customer_id": "STAFF-ADMIN",
                "profile_id": "PROF-ADMIN",
                "full_name": "Admin Dana Sejahtera",
                "nik": "3171012345679999",
                "biometric_sample": "sha256:admin-demo",
                "email": "admin.dana@example.test",
                "phone": "+62-812-9999-9999",
            },
            "account": {"account_id": "ACC-9999", "account_number": "ACC-9999", "balance": 0.0, "currency": "IDR"},
        },
        {
            "username": "auditor",
            "password": "auditor123",
            "role": "auditor",
            "profile": {
                "customer_id": "STAFF-AUDITOR",
                "profile_id": "PROF-AUDITOR",
                "full_name": "Auditor",
                "nik": "3171012345678888",
                "biometric_sample": "sha256:auditor-demo",
                "email": "auditor@example.test",
                "phone": "+62-812-8888-8888",
            },
            "account": None,
        },
        {
            "username": "pentester",
            "password": "pentest123",
            "role": "pentester",
            "profile": {
                "customer_id": "STAFF-PENTESTER",
                "profile_id": "PROF-PENTESTER",
                "full_name": "Pentester",
                "nik": "3171012345677777",
                "biometric_sample": "sha256:pentester-demo",
                "email": "pentester@example.test",
                "phone": "+62-812-7777-7777",
            },
            "account": None,
        },
        {
            "username": "merchant",
            "password": "merchant123",
            "role": "customer",
            "profile": {
                "customer_id": "CUST-MERCHANT",
                "profile_id": "PROF-MERCHANT",
                "full_name": "Synthetic Merchant",
                "nik": "3273999999990001",
                "biometric_sample": "sha256:merchant-demo",
                "email": "merchant@example.test",
                "phone": "+62-812-3333-3333",
            },
            "account": {
                "account_id": "ACC-MERCHANT-001",
                "account_number": "990012340001",
                "balance": 0.0,
                "currency": "IDR",
                "account_type": "Escrow",
                "account_name": "Synthetic Merchant Settlement",
                "bank_name": "Dana Sejahtera Settlement",
                "status": "active",
                "classification": "Confidential",
                "last_activity_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        },
    ]
    db = SessionLocal()
    try:
        users_by_username: dict[str, User] = {}
        for user in seed_users:
            users_by_username[user["username"]] = upsert_user(db, **user)
        db.flush()

        budi_account = db.query(Account).filter(Account.account_id == "ACC-BUDI-001").first()
        maya_account = db.query(Account).filter(Account.account_id == "ACC-MAYA-001").first()
        if budi_account:
            for payload in (
                {
                    "transaction_id": "TRX-BUDI-001",
                    "transaction_ref": "TRX-BUDI-001",
                    "amount": 78000.0,
                    "currency": "IDR",
                    "direction": "debit",
                    "status": "settled",
                    "merchant": "Kopi Ampera",
                    "category": "Food and beverage",
                    "channel": "QRIS",
                    "risk": "low",
                    "risk_score": 12,
                    "created_at": datetime.now(timezone.utc) - timedelta(days=2),
                },
                {
                    "transaction_id": "TRX-BUDI-002",
                    "transaction_ref": "TRX-BUDI-002",
                    "amount": 18500000.0,
                    "currency": "IDR",
                    "direction": "credit",
                    "status": "settled",
                    "merchant": "Payroll PT Dana Sejahtera",
                    "category": "Salary",
                    "channel": "Bank Transfer",
                    "risk": "low",
                    "risk_score": 8,
                    "created_at": datetime.now(timezone.utc) - timedelta(days=1),
                },
            ):
                upsert_transaction(db, budi_account, payload)
        if maya_account:
            for payload in (
                {
                    "transaction_id": "TRX-MAYA-001",
                    "transaction_ref": "TRX-MAYA-001",
                    "amount": 425000.0,
                    "currency": "IDR",
                    "direction": "debit",
                    "status": "settled",
                    "merchant": "Sentra Kesehatan",
                    "category": "Health",
                    "channel": "QRIS",
                    "risk": "medium",
                    "risk_score": 42,
                    "suspicious_reason": "Cross-owner detail reads should be investigated in the lab.",
                    "created_at": datetime.now(timezone.utc) - timedelta(hours=18),
                },
                {
                    "transaction_id": "TRX-MAYA-002",
                    "transaction_ref": "TRX-MAYA-002",
                    "amount": 7250000.0,
                    "currency": "IDR",
                    "direction": "debit",
                    "status": "review",
                    "merchant": "Sarana Digital",
                    "category": "Electronics",
                    "channel": "Virtual Account",
                    "risk": "high",
                    "risk_score": 82,
                    "suspicious_reason": "New beneficiary and high amount in synthetic demo data.",
                    "created_at": datetime.now(timezone.utc) - timedelta(hours=8),
                },
            ):
                upsert_transaction(db, maya_account, payload)
        upsert_segmentation_evidence(db)
        db.commit()
        logger.info("Demo data seeded.", extra={"event": "database_seeded", "outcome": "success"})
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to seed demo data.", extra={"event": "database_seed_failed"})
        raise
    finally:
        db.close()


@app.on_event("startup")
def startup() -> None:
    logger.info("Starting Shield-PDP API.", extra={"event": "service_startup"})
    wait_for_database()
    ensure_database_schema()
    seed_database()


@app.get("/")
def root():
    return {
        "service": "Shield-PDP Security API",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
        "readiness": "/ready",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - STARTED_AT, 2),
    }


@app.get("/ready")
def readiness_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        seeded_users = db.query(User).filter(User.username.in_(["budi", "maya", "admin", "auditor"])).count()
        return {
            "status": "ready",
            "database": "ok",
            "databaseName": database_name(),
            "databaseHost": database_host(),
            "seededUsers": seeded_users,
            "seeded_users": seeded_users,
            "mode": "remote-postgres" if database_host() == "100.110.198.103" else "database-configured",
        }
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable") from exc


@app.get("/metrics", response_class=PlainTextResponse)
def metrics():
    lines = [
        "# HELP shield_pdp_requests_total Total HTTP requests observed by the API.",
        "# TYPE shield_pdp_requests_total counter",
        f"shield_pdp_requests_total {REQUEST_COUNT}",
        "# HELP shield_pdp_errors_total Total HTTP 5xx responses observed by the API.",
        "# TYPE shield_pdp_errors_total counter",
        f"shield_pdp_errors_total {ERROR_COUNT}",
        "# HELP shield_pdp_auth_failures_total Total authentication failures.",
        "# TYPE shield_pdp_auth_failures_total counter",
        f"shield_pdp_auth_failures_total {AUTH_FAILURE_COUNT}",
    ]
    return "\n".join(lines) + "\n"


@app.post("/login", response_model=Token)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    global AUTH_FAILURE_COUNT
    username = form_data.username.strip().lower()
    rate_limit_key = f"{client_ip(request)}:{username}"
    check_login_rate_limit(rate_limit_key)
    logger.info("Login attempt.", extra={"event": "auth_login_attempt", "username": username, "client_ip": client_ip(request)})
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        AUTH_FAILURE_COUNT += 1
        register_login_failure(rate_limit_key)
        record_audit_event(
            db,
            request,
            "login",
            "failure",
            actor=user,
            details={
                "action": "failed login",
                "resourceType": "session",
                "resourceId": username,
                "statusCode": 401,
                "risk": "medium",
                "pdpRelevant": True,
            },
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    if not user.is_active:
        AUTH_FAILURE_COUNT += 1
        record_audit_event(db, request, "login", "inactive", actor=user, details={"action": "inactive login", "statusCode": 403, "risk": "medium"})
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    clear_login_failures(rate_limit_key)
    access_token = create_token(user, "access", timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    refresh_token = create_token(user, "refresh", timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES))
    record_audit_event(
        db,
        request,
        "login",
        "success",
        actor=user,
        details={
            "action": "login",
            "resourceType": "session",
            "resourceId": user.username,
            "statusCode": 200,
            "risk": "low",
            "pdpRelevant": True,
        },
    )
    auth_payload = user_auth_payload(user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "refresh_token": refresh_token,
        "user": auth_payload,
        "role": user.role,
        "customerId": auth_payload.get("customerId"),
        "profileId": auth_payload.get("profileId"),
        "accountIds": auth_payload.get("accountIds") or [],
    }


@app.post("/token/refresh", response_model=Token)
async def refresh_access_token(request: Request, payload: RefreshRequest, db: Session = Depends(get_db)):
    decoded = decode_token(payload.refresh_token, "refresh")
    user = db.query(User).filter(User.id == decoded.get("user_id"), User.username == decoded.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token user is invalid")
    access_token = create_token(user, "access", timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    refresh_token = create_token(user, "refresh", timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES))
    record_audit_event(db, request, "auth.refresh", "success", actor=user)
    auth_payload = user_auth_payload(user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "refresh_token": refresh_token,
        "user": auth_payload,
        "role": user.role,
        "customerId": auth_payload.get("customerId"),
        "profileId": auth_payload.get("profileId"),
        "accountIds": auth_payload.get("accountIds") or [],
    }


@app.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/me/profile", response_model=ProfileOut)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    if not current_user.profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return current_user.profile


@app.get("/me/accounts")
async def get_my_accounts(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_event_id = record_audit_event(
        db,
        request,
        "account list viewed",
        "success",
        actor=current_user,
        target_type="account",
        target_id="self",
        details={
            "action": "account list viewed",
            "resourceType": "account",
            "resourceId": "self",
            "authenticatedOwnerId": user_owner_ref(current_user),
            "statusCode": 200,
            "risk": "low",
            "pdpRelevant": True,
            "personalDataAccessed": True,
        },
    )
    return {"items": [account_to_payload(account, current_user) for account in current_user.accounts], "auditEventId": audit_event_id}


@app.get("/profiles/{user_id}", response_model=ProfileOut)
async def get_profile(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        enforce_user_access(current_user, user_id)
    except HTTPException:
        record_audit_event(db, request, "profile.read", "denied", actor=current_user, target_type="user", target_id=str(user_id))
        raise
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    record_audit_event(db, request, "profile.read", "success", actor=current_user, target_type="user", target_id=str(user_id))
    return profile


@app.get("/accounts/{account_id}")
async def get_account(
    account_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = get_account_by_any_id(db, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if account_id.isdigit():
        try:
            enforce_user_access(current_user, account.owner_id)
        except HTTPException:
            record_audit_event(db, request, "account.read", "denied", actor=current_user, target_type="account", target_id=str(account_id))
            raise
        record_audit_event(db, request, "account.read", "success", actor=current_user, target_type="account", target_id=str(account_id))
        return account

    target_owner = account.owner
    is_cross_owner = target_owner is not None and current_user.id != target_owner.id
    evidence_id = None
    if is_cross_owner:
        evidence_id = create_pentest_evidence(
            db,
            finding_id="FIND-ACCOUNT-IDOR",
            vulnerability_type="Account IDOR",
            severity="critical",
            cvss=9.1,
            affected_endpoint=canonical_endpoint(request),
            affected_object=account_ref(account),
            authenticated_user=current_user,
            target_owner=target_owner,
            business_impact="A customer can view another synthetic customer's masked account metadata by changing the accountId.",
            pdp_impact="Object-level authorization failure exposes financial personal data and requires PDP-relevant access logging.",
            request_summary=f"{current_user.username} requested accountId {account_ref(account)} through the vulnerable lab endpoint.",
            response_summary="HTTP 200 returned masked cross-owner account data in the controlled Shield-PDP lab.",
            remediation="Bind account lookup to the authenticated customer or use the secure comparison endpoint.",
        )
    audit_event_id = record_audit_event(
        db,
        request,
        "cross-user account access" if is_cross_owner else "account detail viewed",
        "success",
        actor=current_user,
        target_type="account",
        target_id=account_ref(account),
        details={
            "action": "cross-user account access" if is_cross_owner else "account detail viewed",
            "resourceType": "account",
            "resourceId": account_ref(account),
            "targetOwnerId": user_owner_ref(target_owner),
            "authenticatedOwnerId": user_owner_ref(current_user),
            "statusCode": 200,
            "risk": "critical" if is_cross_owner else "low",
            "pdpRelevant": True,
            "personalDataAccessed": True,
            "evidenceId": evidence_id,
        },
    )
    payload = account_to_payload(account, current_user)
    payload.update({"auditEventId": audit_event_id, "evidenceId": evidence_id})
    return payload


@app.get("/secure/accounts/{account_id}")
async def get_secure_account(
    account_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = get_account_by_any_id(db, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    target_owner = account.owner
    if target_owner and current_user.role != "admin" and current_user.id != target_owner.id:
        evidence_id = create_pentest_evidence(
            db,
            finding_id="FIND-ACCOUNT-IDOR-BLOCKED",
            vulnerability_type="Secure account access blocked",
            severity="info",
            cvss=0.0,
            affected_endpoint=canonical_endpoint(request, secure=True),
            affected_object=account_ref(account),
            authenticated_user=current_user,
            target_owner=target_owner,
            business_impact="Secure endpoint prevented cross-owner account access in the lab.",
            pdp_impact="Positive PDP evidence: object-level authorization denied access to financial data.",
            request_summary=f"{current_user.username} attempted secure access to {account_ref(account)}.",
            response_summary="HTTP 403 blocked the request and generated audit evidence.",
            remediation="Keep ownership checks on secure account endpoints and regression-test them.",
            status_value="mitigated",
        )
        audit_event_id = record_audit_event(
            db,
            request,
            "secure account access blocked",
            "denied",
            actor=current_user,
            target_type="account",
            target_id=account_ref(account),
            details={
                "action": "secure account access blocked",
                "resourceType": "account",
                "resourceId": account_ref(account),
                "targetOwnerId": user_owner_ref(target_owner),
                "authenticatedOwnerId": user_owner_ref(current_user),
                "statusCode": 403,
                "risk": "low",
                "pdpRelevant": True,
                "personalDataAccessed": False,
                "evidenceId": evidence_id,
            },
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Object access denied", "auditEventId": audit_event_id, "evidenceId": evidence_id})
    audit_event_id = record_audit_event(
        db,
        request,
        "secure account detail viewed",
        "success",
        actor=current_user,
        target_type="account",
        target_id=account_ref(account),
        details={"action": "secure account detail viewed", "statusCode": 200, "risk": "low", "pdpRelevant": True, "personalDataAccessed": True},
    )
    payload = account_to_payload(account, current_user)
    payload["auditEventId"] = audit_event_id
    return payload


@app.get("/me/transactions")
async def get_my_transactions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account_ids = [account.id for account in current_user.accounts]
    transactions = []
    if account_ids:
        transactions = db.query(Transaction).filter(Transaction.account_id.in_(account_ids)).order_by(Transaction.created_at.desc()).all()
    audit_event_id = record_audit_event(
        db,
        request,
        "transaction list viewed",
        "success",
        actor=current_user,
        target_type="transaction",
        target_id="self",
        details={
            "action": "transaction list viewed",
            "resourceType": "transaction",
            "resourceId": "self",
            "authenticatedOwnerId": user_owner_ref(current_user),
            "statusCode": 200,
            "risk": "low",
            "pdpRelevant": True,
            "personalDataAccessed": True,
        },
    )
    return {"items": [transaction_to_payload(transaction, current_user) for transaction in transactions], "auditEventId": audit_event_id}


@app.get("/transactions/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction = get_transaction_by_any_id(db, transaction_id)
    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    target_owner = transaction.account.owner if transaction.account else None
    is_cross_owner = target_owner is not None and current_user.id != target_owner.id
    evidence_id = None
    if is_cross_owner:
        evidence_id = create_pentest_evidence(
            db,
            finding_id="FIND-TRANSACTION-IDOR",
            vulnerability_type="Transaction IDOR",
            severity="critical",
            cvss=9.0,
            affected_endpoint=canonical_endpoint(request),
            affected_object=transaction_ref(transaction),
            authenticated_user=current_user,
            target_owner=target_owner,
            business_impact="A customer can view another synthetic customer's transaction detail by modifying transactionId.",
            pdp_impact="Transaction history is confidential financial data and must be protected by object ownership checks.",
            request_summary=f"{current_user.username} requested transactionId {transaction_ref(transaction)} through the vulnerable lab endpoint.",
            response_summary="HTTP 200 returned cross-owner transaction detail in the controlled Shield-PDP lab.",
            remediation="Bind transaction lookup to authenticated customer-owned accounts or use the secure comparison endpoint.",
        )
    audit_event_id = record_audit_event(
        db,
        request,
        "cross-user transaction access" if is_cross_owner else "transaction detail viewed",
        "success",
        actor=current_user,
        target_type="transaction",
        target_id=transaction_ref(transaction),
        details={
            "action": "cross-user transaction access" if is_cross_owner else "transaction detail viewed",
            "resourceType": "transaction",
            "resourceId": transaction_ref(transaction),
            "targetOwnerId": user_owner_ref(target_owner),
            "authenticatedOwnerId": user_owner_ref(current_user),
            "statusCode": 200,
            "risk": "critical" if is_cross_owner else "low",
            "pdpRelevant": True,
            "personalDataAccessed": True,
            "evidenceId": evidence_id,
        },
    )
    payload = transaction_to_payload(transaction, current_user)
    payload.update({"auditEventId": audit_event_id, "evidenceId": evidence_id})
    return payload


@app.get("/secure/transactions/{transaction_id}")
async def get_secure_transaction(
    transaction_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction = get_transaction_by_any_id(db, transaction_id)
    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    target_owner = transaction.account.owner if transaction.account else None
    if target_owner and current_user.role != "admin" and current_user.id != target_owner.id:
        evidence_id = create_pentest_evidence(
            db,
            finding_id="FIND-TRANSACTION-IDOR-BLOCKED",
            vulnerability_type="Secure transaction access blocked",
            severity="info",
            cvss=0.0,
            affected_endpoint=canonical_endpoint(request, secure=True),
            affected_object=transaction_ref(transaction),
            authenticated_user=current_user,
            target_owner=target_owner,
            business_impact="Secure endpoint prevented cross-owner transaction access in the lab.",
            pdp_impact="Positive PDP evidence: transaction data remained protected by object ownership checks.",
            request_summary=f"{current_user.username} attempted secure access to {transaction_ref(transaction)}.",
            response_summary="HTTP 403 blocked the request and generated audit evidence.",
            remediation="Keep ownership checks on secure transaction endpoints and regression-test them.",
            status_value="mitigated",
        )
        audit_event_id = record_audit_event(
            db,
            request,
            "secure transaction access blocked",
            "denied",
            actor=current_user,
            target_type="transaction",
            target_id=transaction_ref(transaction),
            details={
                "action": "secure transaction access blocked",
                "resourceType": "transaction",
                "resourceId": transaction_ref(transaction),
                "targetOwnerId": user_owner_ref(target_owner),
                "authenticatedOwnerId": user_owner_ref(current_user),
                "statusCode": 403,
                "risk": "low",
                "pdpRelevant": True,
                "personalDataAccessed": False,
                "evidenceId": evidence_id,
            },
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Object access denied", "auditEventId": audit_event_id, "evidenceId": evidence_id})
    audit_event_id = record_audit_event(
        db,
        request,
        "secure transaction detail viewed",
        "success",
        actor=current_user,
        target_type="transaction",
        target_id=transaction_ref(transaction),
        details={"action": "secure transaction detail viewed", "statusCode": 200, "risk": "low", "pdpRelevant": True, "personalDataAccessed": True},
    )
    payload = transaction_to_payload(transaction, current_user)
    payload["auditEventId"] = audit_event_id
    return payload


def transfer_payload(transfer: Transfer, authenticated_user: User) -> dict[str, Any]:
    idor_detected = bool(transfer.idor_detected)
    message = (
        "Controlled Shield-PDP lab vulnerability: sourceAccountId was accepted without ownership validation."
        if idor_detected
        else "Controlled Shield-PDP lab transfer posted to synthetic ledger."
    )
    if not bool(transfer.vulnerable_mode):
        message = "Controlled Shield-PDP lab secure transfer posted to synthetic ledger."
    return {
        "transferSimulationId": transfer.transfer_id,
        "transferId": transfer.transfer_id,
        "sourceTransactionId": transfer.source_transaction_id,
        "destinationTransactionId": transfer.destination_transaction_id,
        "evidenceId": transfer.evidence_id,
        "auditEventId": transfer.audit_event_id,
        "authenticatedUser": authenticated_user.username,
        "sourceAccountId": transfer.source_account_id,
        "destinationAccountId": transfer.destination_account_id,
        "sourceAccountOwner": transfer.source_owner_customer_id or "unknown",
        "destinationAccountOwner": transfer.destination_owner_customer_id or "unknown",
        "amount": float(transfer.amount or 0),
        "currency": transfer.currency or "IDR",
        "sourceBalanceBefore": float(transfer.source_balance_before or 0),
        "sourceBalanceAfter": float(transfer.source_balance_after or 0),
        "destinationBalanceBefore": float(transfer.destination_balance_before or 0),
        "destinationBalanceAfter": float(transfer.destination_balance_after or 0),
        "risk": transfer.risk or ("high" if idor_detected else "low"),
        "idorDetected": idor_detected,
        "message": message,
    }


def transfer_counterparty(account: Account) -> str:
    owner = account.owner
    owner_name = owner.profile.full_name if owner and owner.profile else owner.username if owner else "Synthetic customer"
    return f"{owner_name} - {account.account_name or account_ref(account)}"


def reject_transfer(
    db: Session,
    request: Request,
    current_user: User,
    *,
    message: str,
    status_code: int,
    source: Optional[Account] = None,
    destination: Optional[Account] = None,
    risk: str = "medium",
) -> None:
    audit_event_id = record_audit_event(
        db,
        request,
        "transfer validation failed",
        "failure",
        actor=current_user,
        target_type="transfer",
        target_id=account_ref(source) if source else "unknown",
        details={
            "action": "transfer validation failed",
            "resourceType": "transfer",
            "resourceId": account_ref(source) if source else "unknown",
            "targetOwnerId": user_owner_ref(source.owner) if source else None,
            "authenticatedOwnerId": user_owner_ref(current_user),
            "destinationAccountId": account_ref(destination) if destination else None,
            "statusCode": status_code,
            "risk": risk,
            "pdpRelevant": True,
            "personalDataAccessed": bool(source or destination),
            "message": message,
        },
    )
    raise HTTPException(status_code=status_code, detail={"message": message, "auditEventId": audit_event_id})


def block_secure_transfer_source_mismatch(
    db: Session,
    request: Request,
    current_user: User,
    source: Account,
) -> None:
    source_owner = source.owner
    evidence_id = create_pentest_evidence(
        db,
        finding_id="FIND-TRANSFER-IDOR-BLOCKED",
        vulnerability_type="Secure transfer source ownership blocked",
        severity="info",
        cvss=0.0,
        affected_endpoint=canonical_endpoint(request, secure=True),
        affected_object=account_ref(source),
        authenticated_user=current_user,
        target_owner=source_owner,
        business_impact="Secure endpoint prevented a transfer from another synthetic customer's source account.",
        pdp_impact="Positive PDP evidence: source account ownership was enforced before synthetic ledger posting.",
        request_summary=f"{current_user.username} attempted secure transfer from {account_ref(source)}.",
        response_summary="HTTP 403 blocked the modified sourceAccountId before any balance or transaction rows changed.",
        remediation="Keep source ownership validation before transfer ledger posting.",
        status_value="mitigated",
    )
    audit_event_id = record_audit_event(
        db,
        request,
        "secure transfer blocked",
        "denied",
        actor=current_user,
        target_type="transfer",
        target_id=account_ref(source),
        details={
            "action": "secure transfer blocked",
            "resourceType": "transfer",
            "resourceId": account_ref(source),
            "targetOwnerId": user_owner_ref(source_owner),
            "authenticatedOwnerId": user_owner_ref(current_user),
            "statusCode": 403,
            "risk": "low",
            "pdpRelevant": True,
            "personalDataAccessed": False,
            "evidenceId": evidence_id,
        },
    )
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Source account ownership denied", "auditEventId": audit_event_id, "evidenceId": evidence_id})


def request_idempotency_key(request: Request, payload: TransferRequest) -> Optional[str]:
    header_value = request.headers.get("x-idempotency-key") or request.headers.get("idempotency-key")
    candidate = payload.idempotencyKey or header_value
    if not candidate:
        return None
    normalized = str(candidate).strip()
    return normalized[:128] if normalized else None


def post_transfer_ledger(
    *,
    db: Session,
    request: Request,
    current_user: User,
    payload: TransferRequest,
    vulnerable_mode: bool,
) -> dict[str, Any]:
    amount = float(payload.amount)
    if not math.isfinite(amount) or amount <= 0:
        reject_transfer(
            db,
            request,
            current_user,
            message="Transfer amount must be greater than zero.",
            status_code=status.HTTP_400_BAD_REQUEST,
            risk="medium",
        )
    if amount > float(os.getenv("MAX_SYNTHETIC_TRANSFER_AMOUNT", "1000000000")):
        reject_transfer(
            db,
            request,
            current_user,
            message="Transfer amount exceeds the controlled lab limit.",
            status_code=status.HTTP_400_BAD_REQUEST,
            risk="medium",
        )

    idempotency_key = request_idempotency_key(request, payload)
    if idempotency_key:
        existing = (
            db.query(Transfer)
            .filter(Transfer.idempotency_key == idempotency_key, Transfer.authenticated_user_id == current_user.id)
            .first()
        )
        if existing:
            return transfer_payload(existing, current_user)

    source = get_account_by_any_id_for_update(db, payload.sourceAccountId)
    destination = get_account_by_any_id_for_update(db, payload.destinationAccountId)
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source account not found")
    if not destination:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination account not found")
    if source.id == destination.id:
        reject_transfer(
            db,
            request,
            current_user,
            message="Source and destination accounts must be different.",
            status_code=status.HTTP_400_BAD_REQUEST,
            source=source,
            destination=destination,
            risk="medium",
        )
    if (source.status or "active").lower() != "active":
        reject_transfer(
            db,
            request,
            current_user,
            message="Source account is not active.",
            status_code=status.HTTP_400_BAD_REQUEST,
            source=source,
            destination=destination,
            risk="medium",
        )
    if (destination.status or "active").lower() != "active":
        reject_transfer(
            db,
            request,
            current_user,
            message="Destination account is not active.",
            status_code=status.HTTP_400_BAD_REQUEST,
            source=source,
            destination=destination,
            risk="medium",
        )

    currency = source.currency or "IDR"
    destination_currency = destination.currency or "IDR"
    if currency != destination_currency:
        reject_transfer(
            db,
            request,
            current_user,
            message="Source and destination currencies must match.",
            status_code=status.HTTP_400_BAD_REQUEST,
            source=source,
            destination=destination,
            risk="medium",
        )

    source_owner = source.owner
    destination_owner = destination.owner
    source_mismatch = bool(source_owner and source_owner.id != current_user.id)
    if not vulnerable_mode and source_mismatch:
        db.rollback()
        block_secure_transfer_source_mismatch(db, request, current_user, source)

    source_balance_before = float(source.balance or 0)
    destination_balance_before = float(destination.balance or 0)
    if source_balance_before < amount:
        reject_transfer(
            db,
            request,
            current_user,
            message="Insufficient synthetic ledger balance.",
            status_code=status.HTTP_400_BAD_REQUEST,
            source=source,
            destination=destination,
            risk="medium",
        )

    transfer_id = f"{'TRF-SIM' if vulnerable_mode else 'TRF-SEC'}-{uuid.uuid4().hex[:12].upper()}"
    source_transaction_id = f"TRX-{uuid.uuid4().hex[:12].upper()}-DR"
    destination_transaction_id = f"TRX-{uuid.uuid4().hex[:12].upper()}-CR"
    risk = "high" if source_mismatch else "low"
    now = datetime.now(timezone.utc)
    note = payload.note or "synthetic transfer"
    evidence_id = None

    try:
        if vulnerable_mode and source_mismatch:
            evidence_id = create_pentest_evidence(
                db,
                finding_id="FIND-TRANSFER-IDOR",
                vulnerability_type="Transfer IDOR by source account tampering",
                severity="critical",
                cvss=9.3,
                affected_endpoint=canonical_endpoint(request),
                affected_object=account_ref(source),
                authenticated_user=current_user,
                target_owner=source_owner,
                business_impact="A synthetic financial transfer can be initiated from another customer's account by modifying sourceAccountId.",
                pdp_impact="Financial personal data and transaction authorization are impacted by source-account tampering.",
                request_summary=f"{current_user.username} submitted sourceAccountId {account_ref(source)} to the vulnerable transfer endpoint.",
                response_summary="HTTP 201 posted a controlled synthetic debit/credit ledger entry from the tampered source account.",
                remediation="Validate sourceAccountId ownership before posting ledger entries.",
                commit=False,
                raise_on_error=True,
            )

        audit_event_id = record_audit_event(
            db,
            request,
            "transfer source account mismatch" if source_mismatch else "transfer posted",
            "success",
            actor=current_user,
            target_type="transfer",
            target_id=transfer_id,
            details={
                "action": "transfer source account mismatch" if source_mismatch else "transfer posted",
                "result": "success",
                "resourceType": "transfer",
                "resourceId": transfer_id,
                "targetOwnerId": user_owner_ref(source_owner),
                "authenticatedOwnerId": user_owner_ref(current_user),
                "destinationOwnerId": user_owner_ref(destination_owner),
                "statusCode": 201,
                "risk": risk,
                "pdpRelevant": True,
                "personalDataAccessed": True,
                "evidenceId": evidence_id,
                "sourceAccountId": account_ref(source),
                "destinationAccountId": account_ref(destination),
                "amount": amount,
                "sourceTransactionId": source_transaction_id,
                "destinationTransactionId": destination_transaction_id,
            },
            commit=False,
            raise_on_error=True,
        )

        source.balance = source_balance_before - amount
        destination.balance = destination_balance_before + amount
        source.last_activity_at = now
        destination.last_activity_at = now
        source.updated_at = now
        destination.updated_at = now

        db.add(
            Transaction(
                account_id=source.id,
                transaction_id=source_transaction_id,
                transaction_ref=source_transaction_id,
                transfer_id=transfer_id,
                amount=amount,
                currency=currency,
                direction="debit",
                status="settled",
                merchant=f"Transfer to {destination.account_name or account_ref(destination)}",
                counterparty=transfer_counterparty(destination),
                category="Transfer",
                channel="Wallet",
                risk=risk,
                risk_score=85 if source_mismatch else 15,
                suspicious_reason="Source account owner differed from authenticated user in vulnerable lab transfer." if source_mismatch else None,
                note=note,
                occurred_at=now,
                created_at=now,
            )
        )
        db.add(
            Transaction(
                account_id=destination.id,
                transaction_id=destination_transaction_id,
                transaction_ref=destination_transaction_id,
                transfer_id=transfer_id,
                amount=amount,
                currency=currency,
                direction="credit",
                status="settled",
                merchant=f"Transfer from {source.account_name or account_ref(source)}",
                counterparty=transfer_counterparty(source),
                category="Transfer",
                channel="Wallet",
                risk=risk,
                risk_score=85 if source_mismatch else 10,
                suspicious_reason="Received funds from a vulnerable source-account tampering scenario." if source_mismatch else None,
                note=note,
                occurred_at=now,
                created_at=now,
            )
        )
        transfer = Transfer(
            transfer_id=transfer_id,
            authenticated_user_id=current_user.id,
            initiated_by_username=current_user.username,
            source_account_id=account_ref(source),
            destination_account_id=account_ref(destination),
            amount=amount,
            currency=currency,
            note=note,
            simulation_only=0,
            status="settled",
            risk=risk,
            source_owner_id=source_owner.id if source_owner else None,
            source_owner_customer_id=user_owner_ref(source_owner),
            destination_owner_customer_id=user_owner_ref(destination_owner),
            vulnerable_mode=1 if vulnerable_mode else 0,
            idor_detected=1 if source_mismatch else 0,
            source_transaction_id=source_transaction_id,
            destination_transaction_id=destination_transaction_id,
            source_balance_before=source_balance_before,
            source_balance_after=source.balance,
            destination_balance_before=destination_balance_before,
            destination_balance_after=destination.balance,
            idempotency_key=idempotency_key,
            evidence_id=evidence_id,
            audit_event_id=audit_event_id,
            created_at=now,
        )
        db.add(transfer)
        db.commit()
        return transfer_payload(transfer, current_user)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Failed to post synthetic transfer ledger.", extra={"event": "transfer_ledger_failed"})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"message": "Synthetic transfer ledger posting failed."}) from exc


@app.post("/transfers", status_code=status.HTTP_201_CREATED)
async def create_vulnerable_transfer(
    payload: TransferRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return post_transfer_ledger(db=db, request=request, current_user=current_user, payload=payload, vulnerable_mode=True)


@app.post("/secure/transfers", status_code=status.HTTP_201_CREATED)
async def create_secure_transfer(
    payload: TransferRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return post_transfer_ledger(db=db, request=request, current_user=current_user, payload=payload, vulnerable_mode=False)


def segmentation_payload(evidence: SegmentationEvidence) -> dict[str, Any]:
    return {
        "evidenceId": evidence.evidence_id,
        "dbZone": evidence.db_zone,
        "appZone": evidence.app_zone,
        "databaseHost": evidence.database_host,
        "allowedClient": evidence.allowed_client,
        "transport": evidence.transport,
        "postgresListenPolicy": evidence.postgres_listen_policy,
        "publicListen": bool(evidence.public_listen),
        "firewallPolicy": evidence.firewall_policy,
        "segmentationStatus": evidence.segmentation_status,
        "risk": evidence.risk,
        "pdpImpact": evidence.pdp_impact,
        "path": [
            "Frontend/Cloud Portal",
            "API Gateway",
            "Backend API",
            "Tailscale",
            "shield-db PostgreSQL",
        ],
        "createdAt": evidence.created_at.isoformat(),
    }


def get_or_create_segmentation_evidence(db: Session) -> SegmentationEvidence:
    upsert_segmentation_evidence(db)
    db.commit()
    evidence = db.query(SegmentationEvidence).filter(SegmentationEvidence.evidence_id == "EVD-SEG-REMOTE-DB-001").first()
    if not evidence:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Segmentation evidence unavailable")
    return evidence


@app.get("/segmentation/internal-db/status")
async def get_segmentation_status(request: Request, db: Session = Depends(get_db)):
    evidence = get_or_create_segmentation_evidence(db)
    evidence_id = create_pentest_evidence(
        db,
        evidence_id=evidence.evidence_id,
        finding_id="FIND-SEGMENTATION-EVIDENCE",
        vulnerability_type="Segmentation evidence",
        severity="info",
        cvss=0.0,
        affected_endpoint=canonical_endpoint(request),
        affected_object="shield-db PostgreSQL",
        authenticated_user=None,
        target_owner=None,
        business_impact="Database isolation reduces blast radius for the controlled fintech lab.",
        pdp_impact=evidence.pdp_impact,
        request_summary="Segmentation evidence requested for remote PostgreSQL over Tailscale.",
        response_summary="Endpoint returned enforced isolation status without exposing secrets.",
        remediation="Maintain current Tailscale-only PostgreSQL access and firewall policy.",
        status_value="accepted",
    )
    audit_event_id = record_audit_event(
        db,
        request,
        "segmentation evidence generated",
        "success",
        actor=None,
        target_type="segmentation",
        target_id=evidence.evidence_id,
        details={
            "action": "segmentation evidence generated",
            "resourceType": "segmentation",
            "resourceId": evidence.evidence_id,
            "statusCode": 200,
            "risk": "low",
            "pdpRelevant": True,
            "personalDataAccessed": False,
            "evidenceId": evidence_id,
        },
    )
    payload = segmentation_payload(evidence)
    payload["auditEventId"] = audit_event_id
    return payload


@app.get("/secure/segmentation/internal-db/status")
async def get_secure_segmentation_status(request: Request, db: Session = Depends(get_db)):
    evidence = get_or_create_segmentation_evidence(db)
    audit_event_id = record_audit_event(
        db,
        request,
        "secure segmentation evidence viewed",
        "success",
        actor=None,
        target_type="segmentation",
        target_id=evidence.evidence_id,
        details={"action": "secure segmentation evidence viewed", "statusCode": 200, "risk": "low", "pdpRelevant": True, "personalDataAccessed": False, "evidenceId": evidence.evidence_id},
    )
    payload = segmentation_payload(evidence)
    payload["auditEventId"] = audit_event_id
    payload["remediationView"] = "No weakening required. Keep PostgreSQL bound to localhost plus Tailscale IP and keep UFW scoped to shield-cloud over tailscale0."
    return payload


@app.get("/pentest/evidence")
async def list_pentest_evidence(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_privileged_evidence_viewer(current_user):
        audit_event_id = record_audit_event(
            db,
            request,
            "pentest evidence viewed",
            "denied",
            actor=current_user,
            target_type="pentest_evidence",
            target_id="all",
            details={"action": "pentest evidence viewed", "statusCode": 403, "risk": "medium", "pdpRelevant": True, "personalDataAccessed": False},
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Pentest evidence requires admin, auditor, or pentester role", "auditEventId": audit_event_id})
    audit_event_id = record_audit_event(
        db,
        request,
        "pentest evidence viewed",
        "success",
        actor=current_user,
        target_type="pentest_evidence",
        target_id="all",
        details={"action": "pentest evidence viewed", "statusCode": 200, "risk": "low", "pdpRelevant": True, "personalDataAccessed": False},
    )
    evidence = db.query(PentestEvidence).order_by(PentestEvidence.id.desc()).limit(200).all()
    return {"items": [evidence_to_payload(item) for item in evidence], "auditEventId": audit_event_id}


@app.get("/pentest/findings")
async def list_pentest_findings(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_privileged_evidence_viewer(current_user):
        audit_event_id = record_audit_event(
            db,
            request,
            "pentest findings viewed",
            "denied",
            actor=current_user,
            target_type="pentest_findings",
            target_id="all",
            details={"action": "pentest findings viewed", "statusCode": 403, "risk": "medium", "pdpRelevant": True, "personalDataAccessed": False},
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Pentest findings require admin, auditor, or pentester role", "auditEventId": audit_event_id})
    audit_event_id = record_audit_event(
        db,
        request,
        "pentest findings viewed",
        "success",
        actor=current_user,
        target_type="pentest_findings",
        target_id="all",
        details={"action": "pentest findings viewed", "statusCode": 200, "risk": "low", "pdpRelevant": True, "personalDataAccessed": False},
    )
    evidence = db.query(PentestEvidence).order_by(PentestEvidence.id.desc()).limit(200).all()
    return {"items": [evidence_to_finding(item) for item in evidence], "auditEventId": audit_event_id}


def ensure_vulnerable_demo_enabled() -> None:
    if not ENABLE_VULNERABLE_DEMO:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vulnerable demo endpoints are disabled")


@app.get("/lab/idor/profiles/{user_id}", response_model=IDORProfileLeakOut)
async def exploit_idor_profile_demo(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_vulnerable_demo_enabled()
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    # Intentional lab flaw: any authenticated user can request another user's profile by object ID.
    record_audit_event(
        db,
        request,
        "lab.idor.profile_exfiltration",
        "success",
        actor=current_user,
        target_type="user",
        target_id=str(user_id),
        details={"intentional_vulnerable_demo": True, "leaked_fields": ["nik", "biometric_sample", "email", "phone"]},
    )
    return {
        "vulnerability": "IDOR - Insecure Direct Object Reference",
        "exploit_status": "success",
        "attacker_username": current_user.username,
        "requested_user_id": user_id,
        "leaked_username": profile.user.username,
        "leaked_full_name": profile.full_name,
        "leaked_nik": profile.nik,
        "leaked_biometric_sample": profile.biometric_sample,
        "leaked_email": profile.email,
        "leaked_phone": profile.phone,
        "evidence": "Authenticated user supplied another user's object ID and received sensitive PII without ownership validation.",
    }


@app.get("/lab/bola/accounts/{account_id}", response_model=BOLAAccountLeakOut)
async def exploit_bola_account_demo(
    account_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_vulnerable_demo_enabled()
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # Intentional lab flaw: any authenticated user can request another account object by ID.
    record_audit_event(
        db,
        request,
        "lab.bola.account_exfiltration",
        "success",
        actor=current_user,
        target_type="account",
        target_id=str(account_id),
        details={"intentional_vulnerable_demo": True, "leaked_fields": ["account_number", "balance", "owner_id"]},
    )
    return {
        "vulnerability": "BOLA - Broken Object Level Authorization",
        "exploit_status": "success",
        "attacker_username": current_user.username,
        "requested_account_id": account_id,
        "leaked_owner_username": account.owner.username,
        "leaked_owner_user_id": account.owner_id,
        "leaked_account_number": account.account_number,
        "leaked_balance": account.balance,
        "evidence": "Authenticated user supplied another account object ID and received financial data without ownership validation.",
    }


@app.get("/admin/users")
async def list_users(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        audit_event_id = record_audit_event(
            db,
            request,
            "admin route denied",
            "denied",
            actor=current_user,
            target_type="users",
            target_id="admin/users",
            details={
                "action": "admin route denied",
                "resourceType": "users",
                "resourceId": "admin/users",
                "statusCode": 403,
                "risk": "medium",
                "pdpRelevant": True,
                "personalDataAccessed": False,
            },
        )
        create_pentest_evidence(
            db,
            finding_id="FIND-BROKEN-ACCESS-CONTROL-BLOCKED",
            vulnerability_type="Broken access control attempt blocked",
            severity="info",
            cvss=0.0,
            affected_endpoint=canonical_endpoint(request),
            affected_object="admin/users",
            authenticated_user=current_user,
            target_owner=None,
            business_impact="Customer role was denied access to administrative user inventory.",
            pdp_impact="Positive PDP evidence: role-based access control protected internal user records.",
            request_summary=f"{current_user.username} attempted to access admin users route.",
            response_summary="HTTP 403 denied access and wrote an audit event.",
            remediation="Keep admin-only RBAC checks and audit denials.",
            status_value="mitigated",
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Admin privileges required", "auditEventId": audit_event_id})
    audit_event_id = record_audit_event(
        db,
        request,
        "admin users viewed",
        "success",
        actor=current_user,
        target_type="users",
        target_id="all",
        details={"action": "admin users viewed", "statusCode": 200, "risk": "low", "pdpRelevant": True, "personalDataAccessed": True},
    )
    return {
        "items": [
            {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "customerId": user.customer_id,
                "is_active": user.is_active,
            }
            for user in db.query(User).order_by(User.id).all()
        ],
        "auditEventId": audit_event_id,
    }


@app.get("/audit/events")
async def list_audit_events(
    request: Request,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in {"admin", "auditor"}:
        audit_event_id = record_audit_event(
            db,
            request,
            "audit log viewed",
            "denied",
            actor=current_user,
            target_type="audit_events",
            target_id="all",
            details={"action": "audit log viewed", "statusCode": 403, "risk": "medium", "pdpRelevant": True, "personalDataAccessed": False},
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"message": "Audit events require admin or auditor role", "auditEventId": audit_event_id})
    safe_limit = min(max(limit, 1), 200)
    audit_event_id = record_audit_event(
        db,
        request,
        "audit log viewed",
        "success",
        actor=current_user,
        target_type="audit_events",
        target_id="all",
        details={"action": "audit log viewed", "statusCode": 200, "risk": "low", "pdpRelevant": True, "personalDataAccessed": False},
    )
    query = db.query(AuditEvent)
    if current_user.role == "auditor":
        query = query.filter(AuditEvent.pdp_relevant == 1)
    events = query.order_by(AuditEvent.id.desc()).limit(safe_limit).all()
    return {"items": [audit_to_payload(event) for event in events], "auditEventId": audit_event_id}


@app.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    users = db.query(User).count()
    audit_denials = db.query(AuditEvent).filter(AuditEvent.outcome == "denied").count()
    controls = [
        {"name": "JWT authentication", "status": "healthy", "detail": "Access and refresh tokens enabled"},
        {"name": "Object authorization", "status": "healthy", "detail": "Profile and account access restricted by owner/admin"},
        {"name": "RBAC", "status": "healthy", "detail": "Administrative APIs require admin role"},
        {"name": "Audit logging", "status": "healthy", "detail": "Sensitive access attempts are logged with request IDs"},
    ]
    incidents = [
        {"time": "14:23:05", "severity": "high", "title": "BOLA probe blocked", "detail": "Alice denied access to Bob's account"},
        {"time": "14:15:22", "severity": "high", "title": "IDOR probe blocked", "detail": "Unauthorized profile access returned 403"},
        {"time": "13:45:01", "severity": "critical", "title": "Admin endpoint protected", "detail": "Non-admin request denied by RBAC"},
    ]
    return {
        "risk_score": 18 if audit_denials else 12,
        "compliance_score": 92,
        "active_incidents": audit_denials,
        "protected_records": users,
        "services": {"api": "ready", "database": "ready", "gateway": "ready"},
        "controls": controls,
        "incidents": incidents,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
