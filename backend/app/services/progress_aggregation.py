"""Refresh legacy learning summaries from immutable server evaluation evidence."""
from bson import ObjectId


async def refresh_progress_aggregates(db, user_id: str, lesson_id, *, account_id=None):
    """Repair interrupted inserts without rewarding an evaluation twice.

    Evaluation owners are strings; account primary keys normally use ObjectId.
    Both the legacy receipt route and Vowel Studio use this same refresh path.
    Monotonic maxima prevent an older concurrent aggregation overwriting newer
    totals. Evidence deletion needs its own explicit aggregate rebuild.
    """
    progress_filter = {'user_id': user_id, 'lesson_id': lesson_id}
    cursor = await db.evaluations.aggregate([
        {'$match': progress_filter},
        {'$group': {'_id': None, 'attempts': {'$sum': 1},
                    'best': {'$max': '$accuracy'}, 'stars': {'$max': '$stars_earned'},
                    'latest': {'$max': '$created_at'}}},
    ])
    rows = await cursor.to_list(length=1)
    if not rows:
        return
    lesson_totals = rows[0]
    existing = await db.progress.find_one(progress_filter)
    progress_id = existing['_id'] if existing else f'{user_id}:{lesson_id}'
    await db.progress.update_one({'_id': progress_id}, {
        '$setOnInsert': progress_filter,
        '$max': {'attempts': lesson_totals['attempts'], 'best_accuracy': lesson_totals['best'],
                 'stars_best': lesson_totals['stars'], 'last_attempted': lesson_totals['latest'],
                 'completed': lesson_totals['stars'] >= 1},
    }, upsert=True)
    cursor = await db.evaluations.aggregate([
        {'$match': {'user_id': user_id}},
        {'$group': {'_id': None, 'sessions': {'$sum': 1}, 'stars': {'$sum': '$stars_earned'}}},
    ])
    totals = (await cursor.to_list(length=1))[0]
    if account_id is None:
        account_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    await db.users.update_one({'_id': account_id}, {
        '$max': {'total_sessions': totals['sessions'], 'total_stars': totals['stars']},
    })
