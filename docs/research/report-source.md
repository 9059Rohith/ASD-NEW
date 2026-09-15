# ASD-Edge-ST Market Research — Canonical Source Report

**Audience:** Team 96, Sree Taarikaa School clinicians, capstone reviewers  
**Date:** 2026-08-30  
**Scope:** Launched speech-therapy, ASD/AAC, pronunciation-scoring, Indian-language learning, and edge-speech products. The comparison emphasizes Tamil support, offline inference, low-stimulation ASD UX, and clinician analytics. Pricing is included only where an official page exposed a current model; it should be rechecked before procurement.

## Executive answer

No reviewed product combines Tamil articulation practice, phoneme-level automated scoring, child-safe low-sensory interaction, clinician review, and local/edge processing. Existing products establish useful patterns separately:

- child speech apps demonstrate short watch–imitate–repeat loops and contextual rewards;
- ASD education and AAC products demonstrate predictable navigation, caregiver modes, stable symbol placement, and personalized curricula;
- pronunciation APIs demonstrate hierarchical phoneme/syllable/word feedback;
- Indian learning products demonstrate offline-first delivery, school/home continuity, and regional-language relevance; and
- on-device SDKs demonstrate the privacy and latency value of local inference.

ASD-Edge-ST should combine those patterns while avoiding their shared gaps: English-first content, cloud dependence, generic reward intensity, caregiver-only progress summaries, and unactionable aggregate scores.

## Evidence matrix

| Product | Category | Verified capabilities and model | What it contributes | Gap relevant to ASD-Edge-ST |
|---|---|---|---|---|
| Speech Blubs | Child speech practice | Watch-and-repeat peer video modeling, contextual videos, voice-controlled activities, multiple child profiles, subscription after trial ([official site](https://speechblubs.com/)) | Very short imitation loop; model the target before recording; separate child profiles | No Tamil; broad speech/language practice rather than transparent Tamil phoneme/GOP analytics; stimulation can be high for sensory-sensitive users |
| Articulation Station / Little Bee Hive | Clinician articulation content | SLP-oriented articulation materials and organizational membership; legacy Pro is no longer sold as a standalone App Store product ([official comparison](https://www.littlebeespeech.com/resources/hive-pro-comparison.pdf)) | Clinician-curated sound hierarchy and reusable practice lists | English articulation inventory; no on-device Tamil scoring |
| Expressable | Teletherapy | Licensed clinician matching, individualized care plans, home exercises, texting support, and weekly progress tracking; insurance/private-pay model ([official site](https://www.expressable.com/)) | Make clinician ownership and home practice visibly connected | Live-service model is expensive and network-dependent; not Tamil-specific or edge deployed |
| Speech Tutor | Articulation visualization | Concise video animations showing articulation placement, web/mobile access, cloud data across devices ([official site](https://www.speechtutor.org/)) | Pair audio targets with clear mouth-placement visuals | English-focused; cloud account model; no Tamil GOP feedback |
| Otsimo | ASD education / speech | Personalized curriculum, 100+ ad-free games, family mode, offline play, daily/weekly reports, school plans and student reporting ([official product](https://otsimo.com/en/), [user guide](https://otsimo.com/en/user-guide-otsimo-special-education/)) | Separate child and family modes; predictable learning path; ad-free/offline baseline | Five listed interface languages do not include Tamil; progress is activity-centered rather than phoneme/clinician annotation-centered |
| Proloquo2Go | AAC | Stable core-word boards, customization and alternative access options; one-time iOS/macOS purchase; four listed languages ([official product](https://www.assistiveware.com/products/proloquo2go)) | Stable motor-planning layout; accessibility customization; communication always available | AAC, not articulation therapy; no Tamil; Apple-only ecosystem and high upfront price |
| Avaz AAC | Indian AAC | Picture/text AAC, predictive text, frozen essential row, caregiver training; supports Tamil and five other Indian languages; trial plus subscription/lifetime models ([official product](https://avazapp.com/products/avaz-aac-app/), [official pricing](https://avazapp.freshdesk.com/support/solutions/articles/1000213047-what-is-the-price-of-avaz-india-)) | Strong proof that Tamil-first assistive UI and regional-language deployment are viable; stable essential vocabulary | Communication aid rather than articulation scoring; lacks the requested Wav2Vec2/forced-alignment/GOP therapy loop |
| CoughDrop | Collaborative AAC | Offline use with cloud backup, linked supporters, team editing, reports, goals, organization tools; monthly or lifetime plans ([official site](https://www.coughdrop.com/), [pricing](https://www.mycoughdrop.com/pricing)) | Child device should not be taken away for clinician review; sync summaries/notes separately | No Tamil specialization or pronunciation assessment; cloud account remains central for collaboration |
| TouchChat | AAC | Symbol page sets, synthesized/recorded speech, head tracking, switch scanning, multiple access methods; one-time iOS purchase plus optional vocabularies ([official product](https://touchchatapp.com/touchchat-hd-aac)) | Large targets, multiple access paths, and explicit page-set structure | No Tamil among listed languages; AAC rather than speech scoring; Apple-only |
| ELSA Speak | Pronunciation coaching | Immediate, sound-level pronunciation feedback, intonation/fluency analysis, school analytics and large English lesson library ([official API](https://elsaspeak.com/en/elsa-api/), [schools](https://elsaspeak.com/en/enterprise/schools)) | Highlight exact weak unit and connect it to a next action | English coaching and proprietary cloud engine; not ASD-child or Tamil focused |
| SpeechAce | Pronunciation API | Scores at sentence, word, syllable, and phoneme levels with 0–100 quality scores ([official site](https://www.speechace.com/), [API examples](https://github.com/speechace/speechace-api-samples)) | Confirms the useful feedback hierarchy for clinician drill-down | Hosted language-learning API; English-centric and not designed for child biometric minimization |
| Azure Pronunciation Assessment | Pronunciation API | Scripted/unscripted assessment, phoneme granularity, accuracy, fluency, completeness and optional prosody; syllable detail is locale-limited ([official documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment)) | Separate signal dimensions; do not collapse everything into one opaque score | Cloud service; phoneme names and prosody are locale-limited; Tamil is not a documented first-class pronunciation locale |
| Karadi Path | Indian language education | Immersive, multisensory stories/music/action; student-parent app, teacher app and management analytics ([official programme](https://www.karadipath.com/power-english.php), [methodology](https://www.karadipath.com/methodology.php)) | Use culturally familiar stories and a school–home–teacher loop | Teaches English acquisition; no automated articulation scoring or ASD-specific sensory controls |
| Chimple | Offline Indian early learning | Free gamified literacy/numeracy, adaptive self-directed play, online/offline use, class app and teacher dashboards ([official site](https://www.chimple.org/), [about](https://www.chimple.org/about)) | Offline-first content packs, child self-navigation, school/home continuity | Current curriculum pages emphasize English/Hindi rather than Tamil speech therapy; no clinician speech workflow |
| AI4Bharat IndicConformer | Tamil ASR foundation | Open-source ASR suite covering all 22 scheduled Indian languages, including Tamil; monolingual checkpoints available ([official repository](https://github.com/AI4Bharat/IndicConformerASR)) | Strong Tamil transcription fallback and local deployment ownership | ASR alone does not provide forced alignment, GOP, therapy UX, consent, or clinical interpretation |
| Picovoice Leopard | Edge ASR SDK | Local speech-to-text on desktop, mobile, web and Raspberry Pi; audio stays on device; commercial access key model ([official documentation](https://picovoice.ai/docs/leopard/)) | Demonstrates cross-platform local inference and privacy messaging | Listed self-service languages exclude Tamil; proprietary licensing and license validation |
| Vosk | Edge ASR toolkit | Open-source offline recognition for Android, iOS, Raspberry Pi and servers with several language bindings ([official repository](https://github.com/alphacep/vosk-api)) | Lightweight offline packaging pattern | No first-class Tamil pronunciation/GOP pipeline in the official offering |
| ONNX Runtime Web | Browser edge runtime | In-browser inference through WebAssembly, WebGPU or WebNN; local inference can reduce latency, network dependence and data exposure ([official documentation](https://onnxruntime.ai/docs/tutorials/web/)) | Viable future browser inference path for quantized feature/CTC models | Browser hardware/operator variability; model download size and Tamil accuracy require measured validation |

## Consequential requirements and primary evidence

- WCAG 2.1 AA means satisfying every Level A and AA criterion; it explicitly covers cognitive, language, learning, neurological, speech and other disabilities ([W3C Recommendation](https://www.w3.org/TR/WCAG21/)).
- A child’s voice recording is personal information under COPPA; covered services generally need parental notice and verifiable consent before collection. Device-only information that is never transmitted is not collected by the operator ([FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)).
- India’s DPDP Act defines consent and requires special handling for children; the production deployment must be reviewed against the Act and current notified rules before launch ([India Code, Digital Personal Data Protection Act 2023](https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf)).

## Design implications

1. **Three surfaces, one care loop.** Child practice stays minimal. Parents see schedules, consent, and plain-language summaries. Clinicians get assignment, review, phoneme drill-down, notes, and reports. Admin sees service/model health and de-identified operational metrics.
2. **Predictable session anatomy.** Every exercise follows `Preview → Listen → Record → Process locally when available → One feedback action → Done/try again`. Placement and color meanings do not change between lessons.
3. **Low-sensory by default.** No autoplay, no surprise audio, no confetti by default, reduced-motion honored, one focal action, muted background, persistent sensory settings, and large targets.
4. **Actionable scoring.** Show overall accuracy only with phoneme/syllable evidence, confidence/validation source, the weakest unit, and a clinician-editable next cue. Never present GOP as a diagnosis.
5. **Local-first voice path.** Keep raw audio on the edge by default; synchronize scores and short metadata. Upload audio only after explicit purpose-specific caregiver consent and make deletion available.
6. **Tamil culture is product structure, not localization polish.** Tamil script, transliteration, locally familiar words/stories, Tamil audio exemplars, and clinician-authored prompts are first-class content.

## Gap matrix and confidence

| Claim | Evidence | Confidence | Remaining gap / next validation |
|---|---|---:|---|
| Market lacks the full Tamil + ASD + GOP + edge + clinician combination | Official product capability/language pages above | High for reviewed set; not proof of the entire market | Re-run landscape review before commercialization |
| Local-first audio materially improves privacy posture | FTC device-only distinction; ONNX/Picovoice local processing docs | High | Perform a deployment-specific data-flow and legal review |
| Child and clinician interfaces need distinct density | Otsimo family/school modes; Expressable/CoughDrop team workflows | High | Validate terminology and report density with Sree Taarikaa staff |
| IndicConformer is a viable Tamil ASR component | AI4Bharat official repository and local checkpoint already in this repo | High for availability | Benchmark child Tamil speech and noisy classroom audio |
| Browser ONNX is a viable final inference target | ONNX Runtime Web official capability docs | Medium | Measure model size, operator support, cold-start and low-end device latency |

## Research stop rationale

Discovery covered every requested category and the main user/deployment models. Primary sources support the consequential feature, language, deployment, and privacy claims. More product-list expansion would be unlikely to change the product position; the next higher-value evidence is usability validation with Tamil-speaking children/caregivers/clinicians and measured model performance on representative speech.
