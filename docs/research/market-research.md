# ASD-Edge-ST Market Research Summary

The complete source-backed comparison is recorded in [the canonical research report](report-source.md). The central finding is that no reviewed launched product combines **Tamil articulation therapy, ASD-specific low-sensory UX, phoneme-level GOP feedback, clinician review, and edge-local inference**.

| App / product | Category | Key feature pattern worth borrowing | Identified gap |
|---|---|---|---|
| Speech Blubs | Child speech therapy | Watch–imitate–repeat with child models and contextual reinforcement | No Tamil, clinician phoneme analytics, or edge scoring |
| Articulation Station / Hive | SLP articulation | Clinician-curated sound hierarchy and practice materials | English inventory; no Tamil automated scoring |
| Expressable | Teletherapy | Clinician plan → home practice → weekly progress loop | Network/live-service dependent and not Tamil-first |
| Speech Tutor | Articulation visualization | Clear mouth-placement animations | English/cloud-centered; no GOP |
| Otsimo | ASD education | Child/family modes, personalization, ad-free offline play, reports | No Tamil; activity metrics rather than speech evidence |
| Proloquo2Go | AAC | Stable motor-planning layout and deep accessibility settings | AAC rather than articulation; no Tamil |
| Avaz AAC | Indian/Tamil AAC | Tamil-first symbols/text, stable essential vocabulary, caregiver support | No pronunciation scoring or forced alignment |
| CoughDrop | Collaborative AAC | Offline communicator plus remote supporter/report workflow | No Tamil articulation model |
| TouchChat | AAC | Large targets and alternative access paths | No Tamil; Apple-only; AAC rather than therapy |
| ELSA Speak | Pronunciation scoring | Immediate sound-level feedback and educator analytics | English proprietary cloud engine |
| SpeechAce | Pronunciation API | Sentence → word → syllable → phoneme drill-down | English/cloud API; not child/ASD centered |
| Azure Pronunciation Assessment | Pronunciation API | Separate accuracy, fluency, completeness and prosody signals | Cloud/locales limit Tamil clinical use |
| Karadi Path | Indian education | Stories, music and school–home–teacher continuity | English acquisition, not Tamil articulation |
| Chimple | Offline Indian learning | Self-directed offline games and teacher dashboard | Not Tamil speech therapy or clinician scoring |
| AI4Bharat IndicConformer | Indian ASR | Open Tamil ASR checkpoint suitable for local ownership | ASR component only; no therapy workflow |
| Picovoice / Vosk / ONNX Runtime Web | Edge speech | On-device privacy, offline use, predictable latency | Generic runtimes; Tamil scoring model still must be validated |

## Product response

ASD-Edge-ST therefore uses a low-sensory child practice loop, a separate clinician workspace, parent-controlled consent and audio retention, Tamil-script-first content, transparent score provenance, and a local-first inference adapter around the existing Wav2Vec2 CTC + forced alignment + GOP pipeline. See [the product design](../superpowers/specs/2026-08-30-asd-edge-st-rebuild-design.md) for the resulting flows.
