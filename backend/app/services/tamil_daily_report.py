"""Deterministic daily Tamil learning report, with Tamil-shaped PDF output."""
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from fpdf import FPDF

from ..tamil_curriculum import BY_ID

FONT_FILE = Path(__file__).resolve().parents[1] / 'assets' / 'NotoSansTamil-Regular.ttf'
LATIN_FONT_FILE = Path(__file__).resolve().parents[1] / 'assets' / 'NotoSansTamil-Latin.ttf'
GAME_LABELS = {
    'letter-match': 'Letter Match', 'find-letter': 'Find the Letter',
    'picture-word-match': 'Picture to Word Match', 'listen-choose': 'Listen & Choose',
    'word-builder': 'Word Builder',
}
KIND_LABELS = {'vowel': 'Vowels', 'consonant': 'Consonants', 'aytham': 'Aytham',
               'uyirmei': 'Combined letters', 'word': 'Words', 'sentence': 'Sentences'}


def day_window(day: date, tz_name: str):
    zone = ZoneInfo(tz_name)
    start = datetime.combine(day, time.min, zone).astimezone(timezone.utc)
    end = datetime.combine(day + timedelta(days=1), time.min, zone).astimezone(timezone.utc)
    return start.isoformat(), end.isoformat()


def summarize_day(day: date, tz_name: str, attempts: list[dict], games: list[dict]) -> dict:
    """Count only persisted evidence; unscorable audio never becomes a zero."""
    by_kind = {}
    for kind in KIND_LABELS:
        rows = [row for row in attempts if row.get('kind') == kind]
        recognition = [row for row in rows if row.get('mode') == 'recognition']
        scored = [row['accuracy'] for row in rows if row.get('scorable') is True
                  and isinstance(row.get('accuracy'), (float, int))]
        by_kind[kind] = {
            'attempts': len(rows), 'recognition_correct': sum(row.get('correct') is True for row in recognition),
            'recognition_attempts': len(recognition), 'scored_speech': len(scored),
            'speech_average': round(sum(scored) / len(scored), 1) if scored else None,
            'unscored_speech': sum(row.get('mode') == 'audio' and row.get('scorable') is not True for row in rows),
        }
    by_game = {slug: {'attempts': sum(row.get('game_slug') == slug for row in games),
                      'correct': sum(row.get('game_slug') == slug and row.get('correct') is True for row in games)}
               for slug in GAME_LABELS}
    missed = Counter(row['item_id'] for row in [*attempts, *games]
                     if row.get('correct') is False and row.get('item_id') in BY_ID)
    practiced = list(dict.fromkeys(row['item_id'] for row in [*attempts, *games]
                                   if row.get('item_id') in BY_ID))
    return {'day': day.isoformat(), 'timezone': tz_name, 'practice_attempts': len(attempts),
            'game_rounds': len(games), 'by_kind': by_kind, 'by_game': by_game,
            'practiced_items': practiced[:30],
            'review_items': [item for item, _ in missed.most_common(5)],
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'speech_limitations': 'Speech averages include only scorable attempts; missing or uncertain Tamil transcription is not scored.'}


async def collect_day(db, user_id: str, day: date, tz_name: str) -> dict:
    start, end = day_window(day, tz_name)
    window = {'$gte': start, '$lt': end}
    attempts = await db.tamil_attempts.find({'user_id': user_id, 'created_at': window}).to_list(length=10000)
    games = await db.tamil_game_attempts.find({'user_id': user_id, 'created_at': window}).to_list(length=10000)
    return summarize_day(day, tz_name, attempts, games)


def render_pdf(summary: dict, child_name: str = 'Child') -> bytes:
    """Embed the licensed Tamil subset and enable HarfBuzz shaping for Tamil text."""
    class ReportPDF(FPDF):
        def footer(self):
            self.set_y(-14)
            self.set_font('Helvetica', size=8)
            self.set_text_color(90, 110, 95)
            self.cell(text=f"Generated {summary['generated_at'][:19]} UTC | Page {self.page_no()}")

    pdf = ReportPDF(format='A4')
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_font('NotoTamil', fname=str(FONT_FILE))
    pdf.add_font('NotoLatin', fname=str(LATIN_FONT_FILE))
    pdf.set_text_shaping(True)
    pdf.set_fallback_fonts(['NotoTamil'])
    pdf.add_page()
    pdf.set_fill_color(29, 73, 52)
    pdf.rect(0, 0, 210, 43, 'F')
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 19)
    pdf.set_xy(16, 13)
    pdf.cell(text='Tamil learning | Daily report')
    pdf.set_text_color(30, 63, 45)
    pdf.set_xy(16, 50)
    pdf.set_font('NotoLatin', size=10)
    pdf.cell(text=f"Child: {child_name[:70]}")
    pdf.ln(8)
    pdf.cell(text=f"Practice day: {summary['day']} ({summary['timezone']})")
    pdf.ln(9)
    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(text=f"{summary['practice_attempts']} practice attempts  |  {summary['game_rounds']} game rounds")
    pdf.ln(11)
    pdf.set_font('Helvetica', 'B', 13)
    pdf.cell(text='Language activities')
    pdf.ln(8)
    for kind, label in KIND_LABELS.items():
        row = summary['by_kind'][kind]
        pdf.set_font('Helvetica', size=10)
        speech = f" | speech {row['speech_average']}% ({row['scored_speech']} scored)" if row['speech_average'] is not None else ''
        pdf.cell(text=f"{label}: {row['attempts']} attempts | recognition {row['recognition_correct']}/{row['recognition_attempts']}{speech}")
        pdf.ln(6)
    pdf.ln(5)
    pdf.set_font('Helvetica', 'B', 13)
    pdf.cell(text='Five learning games')
    pdf.ln(8)
    for slug, label in GAME_LABELS.items():
        row = summary['by_game'][slug]
        pdf.set_font('Helvetica', size=10)
        pdf.cell(text=f"{label}: {row['correct']}/{row['attempts']} correct")
        pdf.ln(6)
    pdf.ln(5)
    pdf.set_font('Helvetica', 'B', 13)
    pdf.cell(text='Tamil examples practised')
    pdf.ln(10)
    if summary['practiced_items']:
        pdf.set_font('NotoTamil', size=12)
        for item_id in summary['practiced_items'][:12]:
            pdf.multi_cell(w=175, h=8, text=BY_ID[item_id]['text'])
    else:
        pdf.set_font('Helvetica', size=10)
        pdf.cell(text='No activities recorded for this day.')
        pdf.ln(8)
    if summary['review_items']:
        pdf.ln(4)
        pdf.set_font('Helvetica', 'B', 12)
        pdf.cell(text='Suggested review (based on missed answers)')
        pdf.ln(9)
        pdf.set_font('NotoTamil', size=12)
        for item_id in summary['review_items']:
            pdf.multi_cell(w=175, h=8, text=BY_ID[item_id]['text'])
    if summary.get('cumulative_learning'):
        pdf.ln(5)
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(text='Cumulative learning picture')
        pdf.ln(7)
        pdf.set_font('Helvetica', size=9)
        pdf.multi_cell(w=175, h=5, text=summary['cumulative_learning'])
    if summary.get('next_step_item_id') in BY_ID:
        pdf.ln(5)
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(text='Suggested next item')
        pdf.ln(8)
        pdf.set_font('NotoTamil', size=12)
        pdf.multi_cell(w=175, h=8, text=BY_ID[summary['next_step_item_id']]['text'])
    pdf.ln(5)
    pdf.set_font('Helvetica', size=9)
    pdf.multi_cell(w=175, h=5, text=summary['speech_limitations'])
    pdf.multi_cell(w=175, h=5, text='Educational practice only. This report is not a diagnosis or a clinical recommendation.')
    result = pdf.output()
    return bytes(result)
