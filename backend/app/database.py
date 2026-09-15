"""Database connection and collection lifecycle.

PyMongo's native asyncio driver is used instead of Motor.  Motor is now in
deprecated maintenance mode, while ``AsyncMongoClient`` is the supported
asyncio path for new deployments.
"""
import asyncio
from typing import Any, Optional

from pymongo import AsyncMongoClient
from fastapi import HTTPException, status
from .config import settings


class Database:
    """MongoDB database manager."""
    
    client: Optional[AsyncMongoClient] = None
    db: Any = None
    connected: bool = False


db_manager = Database()


def build_mongo_client_options(
    mongodb_url: str,
    *,
    allow_invalid_tls_certificates: bool,
) -> dict[str, Any]:
    """Build connection options without accidentally enabling TLS locally."""
    options: dict[str, Any] = {
        "serverSelectionTimeoutMS": 10000,
        "connectTimeoutMS": 10000,
        "socketTimeoutMS": 20000,
    }
    normalized_url = mongodb_url.lower()
    is_tls_connection = (
        normalized_url.startswith("mongodb+srv://")
        or "tls=true" in normalized_url
        or "ssl=true" in normalized_url
    )
    if is_tls_connection and allow_invalid_tls_certificates:
        options["tlsAllowInvalidCertificates"] = True
    return options


async def connect_to_mongo():
    """Connect to MongoDB Atlas and build the indexes used by the API."""
    try:
        db_manager.client = AsyncMongoClient(
            settings.MONGODB_URL,
            **build_mongo_client_options(
                settings.MONGODB_URL,
                allow_invalid_tls_certificates=settings.MONGODB_TLS_ALLOW_INVALID_CERTIFICATES,
            ),
        )
        db_manager.db = db_manager.client[settings.DB_NAME]

        # Ping to verify connection (will raise if Atlas IP not whitelisted)
        await db_manager.client.admin.command("ping")

        # Create indexes
        await db_manager.db.users.create_index("email", unique=True)
        await db_manager.db.evaluations.create_index("user_id")
        await db_manager.db.progress.create_index([("user_id", 1), ("lesson_id", 1)])
        await db_manager.db.notifications.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.feedback.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.appointments.create_index([("therapist_id", 1), ("scheduled_at", 1)])
        await db_manager.db.appointments.create_index([("user_id", 1), ("scheduled_at", 1)])
        await db_manager.db.announcements.create_index([("published", 1), ("created_at", -1)])
        await db_manager.db.calendar_events.create_index([("user_id", 1), ("start", 1)])
        await db_manager.db.settings.create_index("user_id", unique=True)
        await db_manager.db.wallets.create_index("user_id", unique=True)
        await db_manager.db.wallet_transactions.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.inventory.create_index([("user_id", 1), ("item_slug", 1)], unique=True)
        await db_manager.db.games.create_index("slug", unique=True)
        await db_manager.db.game_scores.create_index([("game_slug", 1), ("score", -1)])
        await db_manager.db.game_scores.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.quizzes.create_index("slug", unique=True)
        await db_manager.db.quiz_attempts.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.videos.create_index("slug", unique=True)
        await db_manager.db.video_progress.create_index([("user_id", 1), ("video_slug", 1)], unique=True)
        await db_manager.db.shop_items.create_index("slug", unique=True)
        await db_manager.db.friendships.create_index([("a", 1), ("b", 1)])
        await db_manager.db.audit_logs.create_index([("created_at", -1)])
        await db_manager.db.audit_logs.create_index("action")
        await db_manager.db.password_resets.create_index("email")
        await db_manager.db.saved_reports.create_index("user_id")
        await db_manager.db.interactive_sessions.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.vowel_sessions.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.tamil_attempts.create_index([("user_id", 1), ("request_id", 1)], unique=True)
        await db_manager.db.tamil_attempts.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.tamil_attempts.create_index([("user_id", 1), ("mode", 1), ("item_id", 1)])
        await db_manager.db.tamil_game_attempts.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.tamil_game_attempts.create_index([("user_id", 1), ("game_slug", 1)])
        await db_manager.db.tamil_report_configs.create_index("user_id", unique=True)
        await db_manager.db.tamil_daily_reports.create_index([("user_id", 1), ("day", -1)])
        await db_manager.db.consent_records.create_index([("user_id", 1), ("created_at", -1)])
        await db_manager.db.consent_records.create_index([("user_id", 1), ("purpose", 1), ("created_at", -1)])
        await db_manager.db.clinical_notes.create_index([("child_id", 1), ("created_at", -1)])

        db_manager.connected = True
        print("[OK] Connected to MongoDB")

    except Exception as e:
        db_manager.connected = False
        db_manager.db = None
        print(f"[WARN] MongoDB connection failed: {type(e).__name__}")
        if settings.APP_ENV in {"production", "prod"}:
            print("[WARN] API is live but readiness remains unavailable until MongoDB is reachable.")
        else:
            print("[INFO] Local development can continue without MongoDB; DB routes return an error.")


async def close_mongo_connection():
    """Close MongoDB connection."""
    if db_manager.client:
        await db_manager.client.close()
        db_manager.connected = False
        print("[INFO] Closed MongoDB connection")


async def ensure_database() -> Any:
    """Return a live database handle, reconnecting stale Atlas connections.

    A process can remain alive while an idle MongoDB connection has been
    dropped by the network or Atlas.  Checking only ``connected`` is not
    enough, so every state-changing request gets a cheap ping first.
    """
    for attempt in range(3):
        if db_manager.db is not None and db_manager.connected:
            try:
                await db_manager.client.admin.command("ping")
                return db_manager.db
            except Exception:
                db_manager.connected = False
                await close_mongo_connection()

        await connect_to_mongo()
        if db_manager.connected:
            return db_manager.db
        if attempt < 2:
            await asyncio.sleep(0.5 * (attempt + 1))

    return get_database()


def get_database() -> Any:
    """Get the verified database or return a clear service-unavailable error."""
    if db_manager.db is None or not db_manager.connected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable. Configure MongoDB and try again.",
        )
    return db_manager.db
