"""Seed a linked ASD-Edge-ST caregiver, therapist and evidence set for development."""
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path
import sys

import bcrypt

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.database import close_mongo_connection, connect_to_mongo, get_database  # noqa: E402
from app.demo_seed import build_demo_documents, build_demo_reset_filters  # noqa: E402


async def main() -> None:
    if settings.APP_ENV in {"production", "prod"}:
        raise SystemExit("Demo data is disabled in production.")

    password = os.getenv("DEMO_CARE_LOOP_PASSWORD", "DemoCare@123")
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    await connect_to_mongo()
    db = get_database()
    documents = build_demo_documents(datetime.now(timezone.utc), password_hash=password_hash)
    try:
        for row in documents["users"]:
            await db.users.replace_one({"_id": row["_id"]}, row, upsert=True)
        for collection_name, reset_filter in build_demo_reset_filters().items():
            collection = db[collection_name]
            await collection.delete_many(reset_filter)
            rows = documents[collection_name]
            if rows:
                await collection.insert_many(rows)
    finally:
        await close_mongo_connection()

    print("Seeded caregiver: meena.caregiver@asd-edge-st.demo")
    print("Seeded therapist: therapist@asd-edge-st.demo")
    print("Password: value of DEMO_CARE_LOOP_PASSWORD (development default: DemoCare@123)")
    print("No raw voice recording was created or retained.")


if __name__ == "__main__":
    asyncio.run(main())
