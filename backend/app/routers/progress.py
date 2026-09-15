"""Progress tracking router."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import List, Dict
from ..database import get_database
from ..utils.jwt_handler import get_current_user, resolve_user_id
from ..services.reward_engine import reward_engine
from ..services.evaluation_receipt import verify_receipt
from ..services.progress_aggregation import refresh_progress_aggregates
from ..curriculum import TAMIL_LESSONS


router = APIRouter(prefix="/api/progress", tags=["progress"])


def serialize_progress_documents(documents: list[dict]) -> list[dict]:
    """Return JSON-safe progress rows while preserving scoring evidence."""
    return [
        {**document, "_id": str(document["_id"])} if document.get("_id") is not None else dict(document)
        for document in documents
    ]


@router.post("/save")
async def save_progress(
    evaluation_data: Dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Save therapy session progress.
    
    Args:
        evaluation_data: Evaluation result data
        current_user: Authenticated user
    """
    db = get_database()
    user_id = str(current_user["_id"])
    receipt = verify_receipt(str(evaluation_data.get('evaluation_receipt', '')), user_id)
    evaluation_data = receipt['result']
    if not evaluation_data.get('scorable'):
        raise HTTPException(422, 'This recording has no speech score to save.')
    
    try:
        # Calculate stars
        stars = reward_engine.calculate_evaluation_stars(evaluation_data)
        
        # Create evaluation document
        evaluation_doc = {
            **evaluation_data,
            '_id': receipt['jti'],
            "user_id": user_id,
            "lesson_id": evaluation_data.get("lesson_id"),
            "phoneme": evaluation_data.get("target_phoneme", ""),
            "lesson_type": next((lesson['type'] for lesson in TAMIL_LESSONS if lesson['id'] == evaluation_data.get('lesson_id')), 'letter'),
            "accuracy": evaluation_data.get("accuracy", 0),
            "phoneme_match": evaluation_data.get("phoneme_match", False),
            "mfcc_score": evaluation_data.get("mfcc_score", 0),
            "gop_score": evaluation_data.get("gop_score", 0),
            "airflow_score": evaluation_data.get("airflow_score", 0),
            "stars_earned": stars,
            "feedback": evaluation_data.get("feedback", ""),
            "syllable_scores": evaluation_data.get("syllable_scores", []),
            "weakest_syllable": evaluation_data.get("weakest_syllable"),
            "duration_ms": round(evaluation_data.get('audio_quality', {}).get('duration_seconds', 0) * 1000),
            "created_at": datetime.utcnow()
        }
        
        # Insert evaluation
        inserted = await db.evaluations.update_one({'_id': receipt['jti']}, {'$setOnInsert': evaluation_doc}, upsert=True)
        # Rebuild aggregates from immutable evidence, including on retry. This
        # repairs an interrupted save without incrementing a counter twice.
        await refresh_progress_aggregates(db, user_id, evaluation_doc['lesson_id'], account_id=current_user['_id'])

        return {
            "message": "Progress saved successfully",
            "already_saved": inserted.upserted_id is None,
            "stars_earned": stars,
            "accuracy": evaluation_data.get("accuracy", 0)
        }
        
    except Exception as e:
        print(f"Error saving progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to save progress")


@router.get("/user/{user_id}")
async def get_user_progress(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all progress for a user."""
    db = get_database()

    # Resolve "me"/email/_id to the real user id (frontend may not hold _id)
    user_id = resolve_user_id(current_user, user_id)

    # Get all progress documents
    progress_docs = await db.progress.find({"user_id": user_id}).to_list(length=100)
    
    # Get recent evaluations
    evaluations = await db.evaluations.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(10).to_list(length=10)
    
    # Convert ObjectId to string
    progress_docs = serialize_progress_documents(progress_docs)
    
    for ev in evaluations:
        ev["_id"] = str(ev["_id"])
        ev["created_at"] = ev["created_at"].isoformat()
    
    return {
        "progress": progress_docs,
        "recent_evaluations": evaluations
    }


@router.get("/summary/{user_id}")
async def get_progress_summary(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get aggregated progress summary for a user."""
    db = get_database()

    # Resolve "me"/email/_id to the real user id (frontend may not hold _id)
    user_id = resolve_user_id(current_user, user_id)

    # The demo identity may have no users document, and an admin may request a
    # different account. Count the resolved owner's saved evidence directly,
    # without relying on a second account lookup or stale cached user counters.
    totals_cursor = await db.evaluations.aggregate([
        {'$match': {'user_id': user_id}},
        {'$group': {'_id': None, 'total_sessions': {'$sum': 1},
                    'total_stars': {'$sum': '$stars_earned'}}},
    ])
    totals_rows = await totals_cursor.to_list(length=1)
    totals = totals_rows[0] if totals_rows else {}
    
    # Get progress stats
    progress_docs = await db.progress.find({"user_id": user_id}).to_list(length=100)
    
    # Get recent evaluations for chart data
    evaluations = await db.evaluations.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(10).to_list(length=10)
    
    # Calculate stats
    completed_lessons = len([p for p in progress_docs if p.get("completed")])
    total_lessons = len(TAMIL_LESSONS)
    avg_accuracy = sum([p.get("best_accuracy", 0) for p in progress_docs]) / len(progress_docs) if progress_docs else 0
    
    # Prepare chart data
    chart_data = []
    for ev in reversed(evaluations):
        chart_data.append({
            "date": ev["created_at"].strftime("%m/%d"),
            "accuracy": ev["accuracy"],
            "lesson_id": ev["lesson_id"]
        })
    
    return {
        "total_sessions": totals.get("total_sessions", 0),
        "total_stars": totals.get("total_stars", 0),
        "completed_lessons": completed_lessons,
        "total_lessons": total_lessons,
        "avg_accuracy": round(avg_accuracy, 2),
        "chart_data": chart_data,
        "progress_by_lesson": serialize_progress_documents(progress_docs)
    }
