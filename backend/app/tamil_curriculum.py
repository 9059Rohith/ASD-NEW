"""Tamil-first practice catalog, independent of the sixteen legacy lesson IDs.

Grammar: https://www.tamilvu.org/courses/teacher_training/tt02/tt0201/tt0102012.htm
Characters: https://www.unicode.org/charts/nameslist/n_0B80.html
The app's timed vowel exercise uses a learner-requested one-second cutoff.
"""
import unicodedata


def vowel(target, text, roman, length, tip_ta, tip):
    row = {'id': f'letter-{target}', 'kind': 'vowel', 'text': text,
           'transliteration': roman, 'meaning': 'Tamil vowel', 'length_label': length,
           'tip_ta': tip_ta, 'tip': tip, 'phoneme_target': target}
    if target not in ('ai', 'au'):
        row['studio_target'] = target
    return row


def phrase(kind, identifier, text, transliteration, meaning, tip_ta, tip, target=None):
    return {'id': f'{kind}-{identifier}', 'kind': kind, 'text': text,
            'transliteration': transliteration, 'meaning': meaning,
            'tip_ta': tip_ta, 'tip': tip, 'phoneme_target': target or identifier.replace('-', '_')}


TAMIL_CATALOG = [
    vowel('a', 'அ', 'a', 'kuril', 'வாயை மெதுவாகத் திறந்து அ என்று குறுகிய ஒலியாகச் சொல்.', 'Open your mouth gently and say the short அ sound once.'),
    vowel('aa', 'ஆ', 'aa', 'nedil', 'வாயைத் திறந்து ஆ என்று நீட்டி ஒலி.', 'Use the same open mouth shape and hold the long ஆ sound.'),
    vowel('i', 'இ', 'i', 'kuril', 'இதழ்களைச் சற்றே விரித்து இ என்று குறுகிய ஒலியாகச் சொல்.', 'Spread your lips slightly and keep the இ sound short.'),
    vowel('ii', 'ஈ', 'ee', 'nedil', 'இ ஒலியை ஈ என்று நீட்டிச் சொல்.', 'Keep the same lip shape and hold the long ஈ sound.'),
    vowel('u', 'உ', 'u', 'kuril', 'இதழ்களைக் குவித்து உ என்று குறுகிய ஒலியாகச் சொல்.', 'Round your lips gently and keep the உ sound short.'),
    vowel('uu', 'ஊ', 'oo', 'nedil', 'இதழ்களைக் குவித்து ஊ என்று நீட்டிச் சொல்.', 'Keep your lips rounded and hold the long ஊ sound.'),
    vowel('e', 'எ', 'e', 'kuril', 'வாயைச் சற்றே திறந்து எ என்று குறுகிய ஒலியாகச் சொல்.', 'Relax your jaw and keep the எ sound short.'),
    vowel('ee', 'ஏ', 'ē', 'nedil', 'எ ஒலியை ஏ என்று நீட்டிச் சொல்.', 'Use the same clear shape and hold the long ஏ sound.'),
    vowel('ai', 'ஐ', 'ai', 'nedil', 'ஐ ஒலியைக் கேட்டு, ஒரே ஒலியாகச் சொல்.', 'Say the complete ஐ glide as one vowel.'),
    vowel('o', 'ஒ', 'o', 'kuril', 'இதழ்களைக் குவித்து ஒ என்று குறுகிய ஒலியாகச் சொல்.', 'Round your lips and keep the ஒ sound short.'),
    vowel('oo', 'ஓ', 'ō', 'nedil', 'ஒ ஒலியை ஓ என்று நீட்டிச் சொல்.', 'Keep the same rounded shape and hold the long ஓ sound.'),
    vowel('au', 'ஔ', 'au', 'nedil', 'ஔ ஒலியைக் கேட்டு, ஒரே ஒலியாகச் சொல்.', 'Say the complete ஔ glide as one vowel.'),
    phrase('word', 'amma', 'அம்மா', 'ammaa', 'Mother', 'அம் என்று தொடங்கி, மா என்று நீட்டிச் சொல்.', 'Begin with அம் and finish with a long மா.'),
    phrase('word', 'appa', 'அப்பா', 'appaa', 'Father', 'அப் என்று தொடங்கி, பா என்று நீட்டிச் சொல்.', 'Close your lips for ப்ப and finish with a long பா.'),
    phrase('word', 'maram', 'மரம்', 'maram', 'Tree', 'மரம் என்ற சொல்லை மெதுவாகவும் தெளிவாகவும் சொல்.', 'Say மரம் slowly, then join the sounds smoothly.'),
    phrase('word', 'naai', 'நாய்', 'naai', 'Dog', 'நா என்று நீட்டித் தொடங்கி, ய் ஒலியுடன் முடி.', 'Begin with a long நா and finish clearly with ய்.'),
    phrase('word', 'yaanai', 'யானை', 'yaanai', 'Elephant', 'யா என்று தொடங்கி, னை என்று முடி.', 'Begin with யா and finish with னை.'),
    phrase('sentence', 'amma-veettil', 'அம்மா வீட்டில் இருக்கிறார்.', 'ammaa veettil irukkiraar', 'Mother is at home.', 'முழு வாக்கியத்தையும் தெளிவாகவும் இயல்பாகவும் சொல்.', 'Say all three words clearly as one natural sentence.', 'amma_viitil_irukkiraar'),
    phrase('sentence', 'naai-odugiradhu', 'நாய் ஓடுகிறது.', 'naai oodugiradhu', 'The dog is running.', 'நாய் என்று நீட்டிச் சொல்லி, ஓடுகிறது என்பதையும் முழுமையாகச் சொல்.', 'Hold the long sounds and complete both words.', 'naai_oodugiradhu'),
]

# Additional beginner examples documented in docs/TAMIL_LANGUAGE_RESEARCH.md.
# Their older loose WAV files are not covered by the checked-in audio manifest;
# fresh pinned-model clips use separate filenames and recorded provenance.
TAMIL_CATALOG.extend([
    phrase('word', 'pazham', 'பழம்', 'pazham', 'Fruit', 'முழுச் சொல்லையும் தெளிவாகச் சொல்.', 'Say the complete Tamil word clearly.'),
    phrase('word', 'aadu', 'ஆடு', 'aadu', 'Goat', 'முழுச் சொல்லையும் தெளிவாகச் சொல்.', 'Say the complete Tamil word clearly.'),
    phrase('word', 'ilai', 'இலை', 'ilai', 'Leaf', 'முழுச் சொல்லையும் தெளிவாகச் சொல்.', 'Say the complete Tamil word clearly.'),
    phrase('word', 'uppu', 'உப்பு', 'uppu', 'Salt', 'முழுச் சொல்லையும் தெளிவாகச் சொல்.', 'Say the complete Tamil word clearly.'),
    phrase('word', 'eli', 'எலி', 'eli', 'Mouse', 'முழுச் சொல்லையும் தெளிவாகச் சொல்.', 'Say the complete Tamil word clearly.'),
    phrase('sentence', 'amma-vaa', 'அம்மா, வா.', 'ammaa, vaa', 'Mother, come.', 'முழு வாக்கியத்தையும் தெளிவாகச் சொல்.', 'Say the complete Tamil sentence clearly.'),
    phrase('sentence', 'appa-vaa', 'அப்பா, வா.', 'appaa, vaa', 'Father, come.', 'முழு வாக்கியத்தையும் தெளிவாகச் சொல்.', 'Say the complete Tamil sentence clearly.'),
    phrase('sentence', 'kavi-vaa', 'கவி, வா.', 'kavi, vaa', 'Kavi, come.', 'முழு வாக்கியத்தையும் தெளிவாகச் சொல்.', 'Say the complete Tamil sentence clearly.'),
    phrase('sentence', 'idhu-maram', 'இது மரம்.', 'idhu maram', 'This is a tree.', 'முழு வாக்கியத்தையும் தெளிவாகச் சொல்.', 'Say the complete Tamil sentence clearly.'),
    phrase('sentence', 'idhu-pazham', 'இது பழம்.', 'idhu pazham', 'This is a fruit.', 'முழு வாக்கியத்தையும் தெளிவாகச் சொல்.', 'Say the complete Tamil sentence clearly.'),
    phrase('sentence', 'appa-maram', 'அப்பா, மரத்தைப் பார்.', 'appaa, maraththaip paar', 'Father, look at the tree.', 'முழு வாக்கியத்தையும் தெளிவாகச் சொல்.', 'Say the complete Tamil sentence clearly.'),
])

# The eighteen mey letters in traditional teaching order. IDs distinguish
# consonants that share a broad Latin transcription (for example ந் and ன்).
# These are orthographic lessons: the current acoustic model has no validated
# isolated-letter targets for them, so they must not receive pronunciation scores.
CONSONANTS = (
    ('ka', 'க', 'k', 'vallinam'), ('nga', 'ங', 'ṅ', 'mellinam'),
    ('ca', 'ச', 'c', 'vallinam'), ('nya', 'ஞ', 'ñ', 'mellinam'),
    ('tta', 'ட', 'ṭ', 'vallinam'), ('nna', 'ண', 'ṇ', 'mellinam'),
    ('ta', 'த', 't', 'vallinam'), ('na', 'ந', 'n', 'mellinam'),
    ('pa', 'ப', 'p', 'vallinam'), ('ma', 'ம', 'm', 'mellinam'),
    ('ya', 'ய', 'y', 'idaiyinam'), ('ra', 'ர', 'r', 'idaiyinam'),
    ('la', 'ல', 'l', 'idaiyinam'), ('va', 'வ', 'v', 'idaiyinam'),
    ('zha', 'ழ', 'ḻ', 'idaiyinam'), ('lla', 'ள', 'ḷ', 'idaiyinam'),
    ('rra', 'ற', 'ṟ', 'vallinam'), ('na-alveolar', 'ன', 'ṉ', 'mellinam'),
)
VOWEL_SIGNS = (
    ('a', ''), ('aa', 'ா'), ('i', 'ி'), ('ii', 'ீ'),
    ('u', 'ு'), ('uu', 'ூ'), ('e', 'ெ'), ('ee', 'ே'),
    ('ai', 'ை'), ('o', 'ொ'), ('oo', 'ோ'), ('au', 'ௌ'),
)
GROUP_LABELS = {'vallinam': 'வல்லினம்', 'mellinam': 'மெல்லினம்', 'idaiyinam': 'இடையினம்'}
VOWEL_ROMAN = {item['phoneme_target']: item['transliteration']
               for item in TAMIL_CATALOG if item['kind'] == 'vowel'}

for consonant_key, base, roman, group in CONSONANTS:
    consonant_id = f'consonant-{consonant_key}'
    TAMIL_CATALOG.append({
        'id': consonant_id, 'kind': 'consonant', 'text': base + '்',
        'transliteration': roman, 'meaning': 'Tamil consonant',
        'letter_group': group, 'letter_group_ta': GROUP_LABELS[group],
        'tip_ta': 'இந்த மெய்யெழுத்தைப் பார்த்து அதன் பெயரைச் சொல்.',
        'tip': 'Look at this Tamil consonant and say its name.',
        'phoneme_target': None, 'can_evaluate': False,
    })

    # A Tamil uyirmei letter is a consonant base followed by one of the twelve
    # vowel signs. NFC keeps the returned strings in a stable Unicode form.
    for vowel_target, sign in VOWEL_SIGNS:
        TAMIL_CATALOG.append({
            'id': f'uyirmei-{consonant_key}-{vowel_target}', 'kind': 'uyirmei',
            'text': unicodedata.normalize('NFC', base + sign),
            'transliteration': roman + VOWEL_ROMAN[vowel_target],
            'meaning': 'Tamil consonant-vowel letter',
            'consonant_id': consonant_id, 'vowel_id': f'letter-{vowel_target}',
            'vowel_target': vowel_target, 'letter_group': group,
            'letter_group_ta': GROUP_LABELS[group],
            'tip_ta': 'மெய்யையும் உயிரையும் சேர்த்து இந்த எழுத்தைப் படி.',
            'tip': 'Read the consonant and vowel together as one Tamil letter.',
            'phoneme_target': None, 'can_evaluate': False,
        })

# Aytham is its own traditional symbol, not a nineteenth mey letter. Its
# realization depends on context, so this lesson teaches recognition/writing
# without inventing an isolated-sound pronunciation score.
TAMIL_CATALOG.append({
    'id': 'aytham-symbol', 'kind': 'aytham', 'text': 'ஃ',
    'transliteration': 'āytam', 'meaning': 'Tamil aytham symbol',
    'tip_ta': 'ஃ என்பது ஆய்த எழுத்து. இதை எழுத்தாக அறிந்து எழுதிப் பழகுங்கள்.',
    'tip': 'Aytham is a distinct Tamil symbol. Recognize and write ஃ; its sound depends on the word.',
    'phoneme_target': None, 'can_evaluate': False,
})

# Checked-in listening examples have validated PCM16 audio and exact source
# provenance in assets/tamil-reference/manifest.json. Vowel cards expose local
# human examples; the studio endpoint remains available for its own UI.
# These clips already have source metadata and file hashes in the shipped manifest.
REFERENCE_AUDIO_IDS = {
    'letter-ai', 'letter-au',
    'sentence-amma-veettil', 'sentence-naai-odugiradhu',
}
NEW_REFERENCE_AUDIO_IDS = {
    'sentence-amma-vaa', 'sentence-appa-vaa', 'sentence-kavi-vaa',
    'sentence-idhu-maram', 'sentence-idhu-pazham', 'sentence-appa-maram',
}
WORD_REFERENCE_AUDIO_IDS = {
    'word-amma', 'word-appa', 'word-maram', 'word-naai', 'word-yaanai',
    'word-pazham', 'word-aadu', 'word-ilai', 'word-uppu', 'word-eli',
}
HUMAN_VOWEL_IDS = {f'letter-{target}' for target in
                   ('a', 'aa', 'i', 'ii', 'u', 'uu', 'e', 'ee', 'o', 'oo')}
for item in TAMIL_CATALOG:
    if item['kind'] not in {'consonant', 'uyirmei', 'aytham'}:
        item['can_evaluate'] = True
    if item['id'] in WORD_REFERENCE_AUDIO_IDS:
        item['audio_url'] = f"/assets/tamil-reference/{item['id']}-valluvar.wav"
        item['audio_kind'] = 'synthetic_tamil'
    elif item['id'] in REFERENCE_AUDIO_IDS:
        item['audio_url'] = f"/assets/tamil-reference/{item['id']}.wav"
        item['audio_kind'] = 'human_tamil' if item['id'] in ('letter-ai', 'letter-au') else 'synthetic_tamil'
    elif item['id'] in NEW_REFERENCE_AUDIO_IDS:
        # New filenames preserve older loose WAVs while the pinned model
        # generates verified clips with exact hashes in the manifest.
        item['audio_url'] = f"/assets/tamil-reference/{item['id']}-generated.wav"
        item['audio_kind'] = 'synthetic_tamil'
    elif item['id'] in HUMAN_VOWEL_IDS:
        item['audio_url'] = f"/assets/tamil-reference/{item['id']}-human.wav"
        item['audio_kind'] = 'human_tamil'

# The authored list is the teaching order. Expose it explicitly so clients do
# not accidentally reorder lessons when catalog storage changes.
for display_order, item in enumerate(TAMIL_CATALOG):
    item['display_order'] = display_order
    item['audio_available_human'] = item.get('audio_kind') == 'human_tamil'

BY_ID = {item['id']: item for item in TAMIL_CATALOG}
