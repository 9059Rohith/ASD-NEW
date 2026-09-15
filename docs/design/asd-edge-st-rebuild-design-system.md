# ASD-Edge-ST Rebuild Design System

## Accepted concepts

- Caregiver primary screen: `docs/design/asd-edge-st-caregiver-dashboard-concept.png` (1536 × 1024)
- Therapist review state: `docs/design/asd-edge-st-therapist-review-concept.png` (1536 × 1024)

Both concepts were generated with the built-in Image Gen tool and inspected at original resolution. The visible UI is a design specification; implementation text and controls remain code-native.

## Layout

- Desktop canvas: true white `#FFFFFF`.
- Sidebar: 252 px at 1536 px viewport; pale cool gray/blue `#F7F9FD`; 1 px right border.
- Top header: 78–80 px; white with 1 px bottom border.
- Main gutter: 40–60 px depending on viewport; content max width uses the available shell rather than a centered narrow column.
- Caregiver composition: welcome/actions → 92 px plan rail → 60/40 evidence and guidance columns.
- Therapist composition: breadcrumb/heading → three summary blocks → 2/3 evidence + 1/3 note editor.
- Mobile: sidebar becomes a top/menu drawer; all two-column regions collapse to one column; the primary action precedes evidence.

## Color tokens

| Token | Value | Use |
|---|---|---|
| `--care-canvas` | `#FFFFFF` | main background |
| `--care-rail` | `#F7F9FD` | sidebar and quiet row fill |
| `--care-ink` | `#08194F` | headings and primary text |
| `--care-muted` | `#53617A` | supporting text |
| `--care-border` | `#D6DDEB` | borders and chart grid |
| `--care-primary` | `#1637B7` | navigation, primary action, focus |
| `--care-primary-soft` | `#EEF3FF` | selected rows/nav |
| `--care-teal` | `#078A86` | success and progress evidence |
| `--care-teal-soft` | `#E5F5F3` | trend fill and local status |
| `--care-amber` | `#D96D00` | attention/weak target |
| `--care-focus` | `#F5A11A` | 3 px focus ring around primary recording action |

No gradient is used. Color always appears with text, icon or numeric evidence.

## Typography

- Family: existing project sans stack, with `Inter`, `Noto Sans Tamil`, `Segoe UI`, sans-serif fallbacks.
- Page title: 44–48 px desktop, 34 px tablet, 28–30 px mobile; 700–750 weight; 1.05–1.15 line height.
- Section heading: 22–24 px, 700.
- Body/control: 16–18 px, 450–600.
- Table/chart label: 14–16 px, 450–600; never browser-default styling.
- Tamil targets: `Noto Sans Tamil` fallback, 28–36 px depending on context, 600–700.

## Components

- **Brand rail:** generated concept mark may be simplified to a code-native Tamil `அ` mark; never a generic “SE” monogram.
- **Navigation row:** 64–72 px tall, 18 px label, 24–28 px 2 px outline icon. Selected state uses left indigo rule plus soft fill.
- **Primary action:** 52–58 px height, indigo solid background, white text, 12 px radius; optional amber external focus ring only for practice.
- **Secondary action:** underlined indigo text with 22–24 px outline icon.
- **Plan rail:** one open bordered frame; numbered 44 px indigo circles and dashed connectors; no nested cards.
- **Evidence frame:** 1 px border, 12 px radius, white fill, no shadow. It may contain a chart or table.
- **Table:** open header and rows with horizontal rules; selected/focus row uses a soft cool fill. Columns remain aligned at desktop.
- **Summary block:** simple bordered rectangle with one icon, label and value. Use only in the therapist state where the concept shows three.
- **Note editor:** labelled textarea, next-target field, native accessible checkbox, solid primary Save button.
- **Local status:** icon + two text lines; no pill/badge treatment.

## Icon inventory

Use the existing Lucide set at 2 px stroke where the metaphor matches:

- caregiver: Home, Mic, ChartNoAxesCombined/BarChart3, FileText, Users, Settings, History, MonitorCheck, CalendarDays, TrendingUp;
- therapist: ArrowLeft, ClipboardList, FileBarChart, Settings, Target, Mic, Info, Check;
- utility: Users mode selector and profile avatar.

Icons are 24–28 px in navigation, 20–24 px in controls, and 36–42 px only in summary blocks. Filled icons are not substituted for the outline language.

## Allowed above-the-fold copy

### Caregiver

`ASD-Edge-ST`, `Overview`, `Practice`, `Progress`, `Reports`, `Care team`, `Settings`, `Good morning, Meena`, `Kavi is ready for a short Tamil practice.`, `Start practice`, `View session history`, `Today’s plan`, `1 Listen`, `2 Record`, `3 Review`, `Progress this month`, `Sounds to practise`, `Care team note`, `Voice processing:`, `On this device`, `Parent view`.

### Therapist

`ASD-Edge-ST`, `Caseload`, `Assignments`, `Reports`, `Settings`, `All children`, `Kavi’s speech review`, `6 recent sessions · Last active today`, `Overall accuracy`, `Practice sessions`, `Focus sound`, `Phoneme evidence`, `Raw audio not retained`, `Recent sessions`, `Clinical note`, `Note`, `Next target (optional)`, `Visible to caregiver`, `Save note`, `Therapist view`.

Live user names, dates, values and Tamil targets may replace the seeded values without changing the hierarchy. Functional error/loading/empty-state text is an intentional necessity outside the static concept.

## Image Gen prompts

The final caregiver prompt requested the complete caregiver dashboard with the exact copy, fixed sidebar, open plan/evidence layout, true-white canvas, navy/indigo/teal palette, low-sensory constraints and no gradients/cards/marketing chrome. The final therapist prompt referenced that image and requested a matching table-driven clinical review with exact phoneme evidence and note composer copy. Both used the `ui-mockup` taxonomy and the built-in Image Gen mode.
