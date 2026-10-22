# In-person GTM, event lead capture and digital business cards

**Full market report** — every offering, every player. Layout mirrors
`research/RevenueHero_Lead_Routing_Analysis_Classified.docx`. Research window:
2024–2026 (primary focus 2025–2026). Compiled 2026-10-22.

> Tag vocabulary used throughout: **[CAPTURE]** badge/QR/card capture ·
> **[CARD]** digital business card · **[CONTACTS]** contact book / personal CRM
> · **[EVENT]** event workflow & attribution · **[ENRICH]** enrichment/signals ·
> **[ROUTING]** assignment/routing · **[SCHEDULING]** booking/availability ·
> **[PLATFORM]** event platform · **[DATA]** data/infra. Maturity tags where
> useful: **[SHIPPED]**, **[BETA]**, **[CLAIMED]**.

---

## Contents and reading paths

- **If you are choosing a product to build:** read §1 (executive conclusions),
  §3 (market map), §4 (capability matrix), §12 (pricing), then Part I §D
  (playbooks) and §G (what it changes for RevenueHero).
- **If you are evaluating vendors:** read §5 (dossiers), §6 (capability
  catalog), §7 (APIs/reliability), §11 (acceptance protocol).
- **If you want the theory:** read Part I §A–§C, then §F (decisions hidden
  behind a checkbox).
- **If you need sources:** the Evidence register at the end (`S##` IDs).

**Scope boundaries that matter.**

- This report covers the **in-person GTM** market: event lead capture, badge
  scanning, digital business cards, contact capture/enrichment, event
  intelligence/attribution, and the routing/booking layers that connect them.
- It includes **adjacent** categories (event platforms, scheduling/routing
  engines, enrichment providers) only where they compete for the same budget or
  user moment.
- It is **not** a legal, security or procurement opinion. Vendor claims are
  marked as claims; where evidence is thin, the report says so.

---

# Part I. Concepts, workflows and what the labels conceal

## A. What this market actually is

### A1. Five layers, and most vendors own only one or two

The market looks like a jumble of "business card" and "badge scanner" apps, but
it decomposes into five layers. Nearly every product is a partial stack.

| Layer                        | The job                                                                                                 | Representative owners                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **1. Capture**               | Get the person's identity from a badge, card, QR, LinkedIn profile or manual entry — offline-tolerant.  | Popl, Blinq, Wave, BoothIQ, Vendelux, Captello, Zuant, iCapture, SnapAddy, B2Brain              |
| **2. Identity & enrichment** | Turn "name + company" into a verified email, phone, title, LinkedIn, firmographics.                     | Apollo, Clay, Crustdata, ZoomInfo, Clearbit, Ocean; Popl/Blinq/Captello build waterfalls on top |
| **3. Routing**               | Decide _who owns this_ — match to CRM owner, territory, round-robin, weighted, caps.                    | LeanData, Chili Piper Distro, Distribution Engine, LeadAngel, Default, RevenueHero              |
| **4. Booking**               | Turn the routed owner into a _booked meeting_ — availability, slots, confirmation, reschedule, no-show. | Calendly, Chili Piper, RevenueHero, LeanData BookIt; iCapture/B2Brain/Captello do it in-flow    |
| **5. Attribution**           | Prove what the event produced — scan → CRM → pipeline → revenue.                                        | Captello, Vendelux, Popl, Blinq, B2Brain, Cvent                                                 |

**The structural finding:** layer 1 is commoditising toward free (Vendelux's
scanner is $0; Wave is £60/user/yr; a Replit GTM lead rebuilt scan→enrich→route
in ~20 minutes for ~£1,128/yr). Layer 5 is where the money moved. **No single
vendor credibly owns all five end-to-end** — that is the opening.

### A2. The nouns: what is being captured or routed?

| Entity           | Capture job                           | Routing job                             | Illustrative result                        |
| ---------------- | ------------------------------------- | --------------------------------------- | ------------------------------------------ |
| **Person**       | Badge/card/QR/LinkedIn → contact      | Assign an owner                         | "Ada from Acme is now owned by rep B"      |
| **Account**      | Firmographic enrichment, domain match | Match to existing account/owner         | "Acme is a customer; route to its AE"      |
| **Meeting**      | (Not a capture act)                   | Book the right rep's calendar           | "Meeting booked with the AE at 10:16am"    |
| **Conversation** | Record/transcribe/notes               | Attach to the person; derive qualifiers | "Budget + timeline captured from the talk" |
| **Signal**       | Job change / funding / hiring         | Trigger an outreach motion              | "New sales leader → reach out"             |

### A3. Capture, enrichment, routing, booking and attribution are not synonyms

A common buying mistake — and a common marketing trick — is to treat these as
one feature. They have different failure modes, different owners, and different
economics.

| Term        | What it does                  | What it does **not** establish                                |
| ----------- | ----------------------------- | ------------------------------------------------------------- |
| Capture     | Produces a candidate identity | That the identity is correct or complete                      |
| Enrichment  | Fills missing fields          | That the person is the right buyer, or that data is consented |
| Routing     | Chooses an owner              | That the owner is available, or that the record is written    |
| Booking     | Creates a meeting             | That the meeting will be held                                 |
| Attribution | Links event → pipeline        | That the attribution is causal or audited                     |

### A4. The buyer and the user are different people

The **user** is a rep on a show floor at 9am with bad Wi-Fi; they optimise for
speed and not losing the lead. The **buyer** is a VP of Event Marketing, Demand
Gen or RevOps; they optimise for predictable cost, CRM hygiene, and provable
pipeline. Almost every product's friction comes from serving one and pricing the
other. This is why "expensive" is the top complaint in the category while
adoption persists.

---

## B. How an in-person capture workflow works

### B1. From a badge tap to an accountable outcome

| Stage            | What the system evaluates                    | Output / operator question                      |
| ---------------- | -------------------------------------------- | ----------------------------------------------- |
| **1. Capture**   | Badge/card/QR/LinkedIn/manual; offline queue | Did we get a usable name + company?             |
| **2. Normalise** | OCR / decode; field extraction               | Is the identity confident enough to enrich?     |
| **3. Enrich**    | Waterfall across providers; verification     | Do we have a verified email/phone?              |
| **4. Qualify**   | Custom qualifiers; ICP score; notes/voice    | Is this worth a rep's time, and which one?      |
| **5. Route**     | Owner match, territory, round-robin, caps    | Who owns this, and why?                         |
| **6. Book**      | Availability, slots, conference links        | Is a meeting on the calendar before they leave? |
| **7. Sync**      | CRM write, dedupe, field mapping             | Is the CRM the system of record?                |
| **8. Attribute** | Event tag, pipeline, held/no-show            | Did the event produce pipeline?                 |

### B2. A complete example

A rep scans a badge at 10:14am. Enrichment resolves a verified email in ~6s. A
qualifier ("evaluating this year?") is answered "yes." The router matches the
domain to an existing account with an assigned AE, checks that AE's calendar,
and the rep books a 20-minute slot for Thursday — writing the meeting and the
contact to Salesforce and tagging both with the event. The morning-after report
shows the lead moved to "meeting booked," and the event's pipeline figure
updates. **The whole value is that this happened at 10:16am, not 7–10 business
days later.**

### B3. Re-entry and follow-up are business decisions, not afterthoughts

What happens when the prospect doesn't book, the meeting is cancelled, or the
rep is unavailable is a **policy choice**, not an edge case. Mature products
define: hold vs assign, fallback pool vs queue, re-nurture vs suppress, and how
a no-show is credited back to the round-robin. Most capture tools stop at
"synced to CRM."

### B4. Success is not a single green check

A scan is not a lead, a sync is not a follow-up, and a booking is not a held
meeting. The metrics that matter are **capture→booked**, **booked→held**, and
**event→pipeline**, each with an owner and a timestamp.

---

## C. Different interpretations of the market

### C1. Six operating models buyers are actually choosing between

| Operating model            | What "capture this lead" means               | The consequential policy         |
| -------------------------- | -------------------------------------------- | -------------------------------- |
| **Card-first networking**  | Share a card; exchange details               | Identity and brand, not pipeline |
| **Booth capture**          | Scan a badge; sync to CRM                    | Speed-to-CRM and dedupe          |
| **Event pipeline**         | Capture → qualify → route → book → attribute | Ownership, booking, ROI proof    |
| **Pre-event intelligence** | Decide _which events and people_ matter      | Data quality, coverage           |
| **Conversation capture**   | Record/transcribe/summarise the talk         | Consent, accuracy, retention     |
| **Field/365 GTM**          | Capture anywhere, not just a booth           | Offline reliability, portability |

### C2. How vendors package the problem

| Product          | Its centre of gravity          | What the operator principally buys      |
| ---------------- | ------------------------------ | --------------------------------------- |
| Popl             | In-person GTM platform         | Brand + enterprise capture              |
| Blinq            | AI contacts platform           | Card → contacts → CRM, per-lead pricing |
| Wave Connect     | Price-transparent capture      | Per-scan credits, SMB                   |
| BoothIQ          | Free capture land-grab         | Flat team price, voice notes            |
| Vendelux         | Event intelligence             | Free scanner → paid platform            |
| Captello         | Event-to-revenue intelligence  | Deepest feature surface                 |
| Momencio         | Field engagement               | Content + capture + follow-up           |
| iCapture (Cvent) | Exhibitor capture inside Cvent | Clean data + in-flow booking            |
| Zuant            | Enterprise branded capture     | Customisation + EU compliance           |
| SnapAddy         | CRM data quality               | Cheapest credible event capture (DACH)  |
| B2Brain          | Leads-to-Meeting               | Book the meeting before they leave      |
| Chili Piper      | Routing + conversion           | Distro + scheduling                     |
| RevenueHero      | Explainable routing + booking  | Audit trail + conversion                |

### C3. The same word can describe different machinery

"Lead capture" can mean a phone camera scanning a badge, a form on a landing
page, or a CRM webhook. "Routing" can mean round-robin, territory assignment, or
CRM owner lookup. "Attribution" can mean an event tag or a modelled pipeline
number. **The report tags every feature with its layer so the words cannot hide
the machinery.**

---

## D. Fourteen in-person GTM playbooks

Each playbook is a workflow a buyer actually runs. Tags: `[CAPTURE]`, `[EVENT]`,
`[CARD]`, `[ROUTING]`, `[SCHEDULING]`, `[ADJACENT]`.

- **D01. `[EVENT]` Booth scan → routed, booked meeting.** The core loop. Badge
  scan → enrich → qualify → match owner → book on the spot → CRM + attribution.
  _Owned by:_ iCapture, B2Brain, Captello, Momencio, Popl (partial).
- **D02. `[EVENT]` Self-serve booth QR → capture → book.** Prospect scans the
  event QR, submits a short form, and books. _Owned by:_ RevenueHero, Popl,
  Chili Piper.
- **D03. `[CARD]` Card exchange → contact created.** Tap/scan a card; both sides
  get a contact. _Owned by:_ Blinq, HiHello, Linq, Mobilo, Popl.
- **D04. `[CAPTURE]` Offline capture → deferred sync.** Everything captured
  without Wi-Fi, flushed on reconnect. _Owned by:_ all major capture vendors;
  reliability varies.
- **D05. `[CONTACTS]` Personal contact book → CRM.** Rep's address book syncs to
  CRM. _Owned by:_ Blinq, Covve, Dex, Cloze.
- **D06. `[ENRICH]` Name + company → complete contact.** Waterfall enrichment at
  capture. _Owned by:_ Blinq, Popl, Captello, Wave, iCapture.
- **D07. `[EVENT]` Post-event list import → enrich → route.** CSV → enriched →
  CRM → follow-up. _Owned by:_ Popl List Enrichment, Captello, Wave.
- **D08. `[ROUTING]` CRM owner match.** Match the person/account to its CRM
  owner and assign. _Owned by:_ LeanData, Chili Piper, RevenueHero, iCapture.
- **D09. `[ROUTING]` Weighted / round-robin distribution.** Fair assignment
  across a team with weights and caps. _Owned by:_ RevenueHero, Chili Piper,
  LeanData, Distribution Engine, LeadAngel.
- **D10. `[SCHEDULING]` Book-on-behalf at the booth.** Rep books the AE's
  calendar for the prospect. _Owned by:_ B2Brain, iCapture, Captello,
  RevenueHero Relays, Chili Piper Handoff.
- **D11. `[EVENT]` Pre-event targeting.** Decide which events/attendees matter,
  pre-book meetings. _Owned by:_ Vendelux, Popl Event Intelligence, Cvent.
- **D12. `[EVENT]` Event ROI attribution.** Scan → CRM → pipeline per event.
  _Owned by:_ Captello, Vendelux, Popl, Blinq, B2Brain.
- **D13. `[ADJACENT]` Conversation capture → structured qualifiers.** Record,
  transcribe, extract, autofill. _Owned by:_ Popl AI Voice, Blinq Notetaker,
  Captello, Momencio, LeadFlow, B2Brain.
- **D14. `[ADJACENT]` 365 / off-floor capture.** Dinners, roadshows, field
  visits. _Owned by:_ Captello 365, Popl, SnapAddy VisitReport.

**Reading the playbooks as product scope:** the only workflow no one owns
end-to-end is **D01 + D02 + D10 + D12** — capture → route → _book_ → attribute,
across an arbitrary portfolio of shows. That is the product.

---

## E. Competitor offerings, explained

Each entry: positioning, what it actually offers, pricing, and the RevenueHero
implication. (Detailed dossiers are in Part II §5.)

### E1. Blinq `[CARD][CAPTURE][ENRICH][EVENT]`

- **What it is:** "The AI contacts platform for the real world." Digital
  business cards + event lead capture + contact capture + AI enrichment + AI
  notetaker + event badges.
- **Offers:** cards (QR/tap/link/wallet), universal contact scanner (badge,
  card, QR, LinkedIn, offline), AI enrichment (25+ sources), AI notetaker, event
  campaigns & attribution, custom qualifiers/lead forms, native CRM sync, Ask
  Blinq (MCP), email signatures, virtual backgrounds, NFC accessories.
- **Pricing:** Free · Premium $7.33/mo · Business $4.99/user/mo **+ $9.99 per
  lead captured/enriched** · Enterprise custom.
- **Strength:** clean brand, broad stack, per-lead pricing, 93% Fortune 500
  claim, HubSpot Ventures.
- **RevenueHero implication:** no native routing/availability/booking — it syncs
  to CRM, not a routed calendar. The booking gap is our wedge.

### E2. Popl `[CARD][CAPTURE][ENRICH][EVENT][CONTACTS]`

- **What it is:** "Complete In-Person GTM platform." AI universal badge scanner,
  business card/LinkedIn QR, enrichment, event campaigns, qualifiers, digital
  cards, **Popl AI Voice** (recorder, note taker, qualification agent,
  voice-to-email), Ask Popl MCP.
- **Pricing:** Free / Pro $7.99 / Pro+ $14.99 (individual); Teams/ELC quote-only
  (Vendr median ~$17,500/yr).
- **RevenueHero implication:** strongest brand and enrichment story; booking is
  a Chili Piper link; pricing opaque. See `research/popl/features.md`.

### E3. Wave Connect `[CAPTURE][ENRICH][EVENT]`

- **What it is:** price-transparent capture: "pay for the leads you capture, not
  seats."
- **Offers:** AI badge/card/LinkedIn scanner, waterfall enrichment, offline,
  qualifiers + voice notes, auto-tag by event, CRM sync (HubSpot, Salesforce,
  Dynamics, Zoho, Pipedrive, HighLevel + Zapier), SOC 2, SSO/SCIM on Enterprise,
  "Book a meeting — coming soon."
- **Pricing:** Free (10 credits) · Pro $7/mo · Teams **$5/user/mo + credits** ·
  **1 credit = $2.50; badge = 4 credits = $10** · Enterprise custom.
- **RevenueHero implication:** best pricing transparency in the category; the
  per-badge meter is a wedge (unlimited scans at a flat price beats it).

### E4. BoothIQ `[CAPTURE][ENRICH][EVENT]`

- **Offers:** AI badge/card/LinkedIn scan, multi-badge, handwritten-note scan,
  offline, enrichment, voice notes + AI summaries, AI follow-up drafts, shared
  workspace, leaderboard, reporting; CRM sync is **Enterprise-only**.
- **Pricing:** Individual **free forever** · Team **$999/mo** (was $499/mo in
  Jun 2026) · Enterprise custom.
- **RevenueHero implication:** gating CRM sync — the one must-have — is its
  biggest vulnerability; a flat team price that _includes_ sync wins that
  cohort.

### E5. Vendelux Lead Scanner `[CAPTURE][ENRICH][EVENT][PLATFORM]`

- **Offers:** free universal badge/card/handwritten scanner, enrichment,
  hot/warm/cold temperature, typed + voice notes, offline, HubSpot one-tap sync
  (Salesforce "planned"), CSV export; the paid platform adds event discovery and
  ROI.
- **Pricing:** Scanner **$0**; platform quote-only. **$50M Series B
  (Jul 2026)**, $71M total.
- **RevenueHero implication:** resets the price anchor for capture; the
  intelligence layer (which events to attend) is genuinely differentiated.

### E6. Captello `[CAPTURE][ENRICH][EVENT][SCHEDULING]`

- **Offers:** IntelliScan universal capture, 5-layer enrichment (125+
  providers), conversation intelligence, behavioural intelligence, document
  library, routing/fulfillment actions, 60+ gamified activations, 365 off-floor
  capture, meeting scheduler, Connexions digital card.
- **Pricing:** **from $500/event** (unlimited users); badge/API kits
  **$736–$1,330/show**; HubSpot connector $3k/yr; realistic ~$1.2k–$1.7k/show.
- **RevenueHero implication:** deepest platform; unpredictable per-event invoice
  is its weakness at 6+ shows.

### E7. Momencio `[CAPTURE][ENRICH][EVENT][SCHEDULING]`

- **Offers:** universal capture, AI EdgeCapture, AI IntelliSense (sentiment,
  ICP, scoring, summaries), LiveMicrosites, content library, in-app meeting
  booking, follow-up campaigns, kiosk, dashboards.
- **Pricing:** Capture **$7,500/yr** · Engage from $10,300/yr · Amaze from
  $13,700/yr; **12-month non-cancellable, no trial, 5-seat minimum**, CRM
  integration is an add-on.
- **RevenueHero implication:** harshest commercial terms in the category; the
  published price + self-serve trial is the counter-position.

### E8. iCapture (Cvent) `[CAPTURE][ENRICH][ROUTING][SCHEDULING]`

- **Offers:** badge/card/photo/manual capture, **130+ badge providers**,
  validation + enrichment (bring-your-own ZoomInfo seats, Apollo firmographics,
  AI-predicted emails flagged), rule-based routing to SF/HS/Marketo/Eloqua,
  **in-flow meeting booking via Calendly/HubSpot
  (individual/round-robin/multi-host)**, offline with deferred sync.
- **Pricing:** **from ~$8,000/yr**; Cvent LeadCapture licences $249/device etc.
- **RevenueHero implication:** the single most important threat — it already
  does capture + route + book, as an add-on inside a platform deal. Beat it on
  speed, cross-show neutrality and price, not breadth.

### E9. Zuant `[CAPTURE][ENRICH]`

- **Offers:** enterprise branded capture (custom skins), barcodes + NFC,
  weighted scoring forms, Showroom content app, Data Vault (GDPR), Zuant Cloud
  reporting, Zuant AI enrichment, Zuant 3D.
- **Pricing:** **none published** (demo-led; "cancel if unhappy after 3 shows").
- **RevenueHero implication:** strong enterprise/EU compliance story; zero price
  transparency disqualifies it from mid-market shortlists.

### E10. SnapAddy `[CAPTURE][CONTACTS]`

- **Offers:** VisitReport (event/field capture, badge provider, media library,
  offline, kiosk, Voice AI), BusinessCards, LeadResearch, DataAgents.
- **Pricing:** BusinessCards €36–60/yr/user · **VisitReport €348/yr/user** ·
  Enterprise named/concurrent/terminal licences; CRM mapping is an add-on.
- **RevenueHero implication:** cheapest credible event capture; event capture is
  a feature inside a CRM-hygiene suite, not a platform.

### E11. B2Brain `[CAPTURE][ROUTING][SCHEDULING][EVENT]`

- **Offers:** badge/card scan, voice+text notes, real-time ICP scoring on the
  floor, **on-the-spot dual calendar invite with round-robin/territory
  routing**, auto deal creation, Salesforce/HubSpot real-time sync, offline iOS,
  per-event ROI, show-over-show memory.
- **Pricing:** Show Pass (per-event) or Pipeline subscription; claims
  "<$125/user/event", "first event free for two users".
- **RevenueHero implication:** best-aimed thesis (book before they leave) and
  the sharpest content operation; iOS-only, small vendor, no SOC 2.

### E12. Emerging / niche capture `[CAPTURE]`

- **LeadFlow (withleadflow.us):** pre-launch; records booth conversations with
  ~95% speaker accuracy (claim), AI extracts pain/buying signals, CRM sync.
- **Luminik:** event capture with pipeline in CRM, **from $299/mo** (published).
- **ConferenceCRM:** Claude/MCP-native capture, **$49/mo flat** + Claude sub.
- **Mobly:** badge scanning + ICP scoring + enrichment (quote-only; G2 sync
  complaints).
- **Romify:** CRM-native lead retrieval (Salesforce/HubSpot).
- **Orvo:** voice-memo personal CRM, $15–30/mo.

### E13. Digital-card players `[CARD][CONTACTS]`

| Player                    | What they offer                                                                                                                                                                                                                                                                                                                                                        | Public price                                                                     | Stance                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **HiHello**               | "Professional Presence and Lead Capture Platform": cards, **email-signature manager with banner campaigns**, virtual backgrounds, company directory, universal contact scanner (5/20/50-per-user scans), enrichment, custom lead forms, CRM (SF/HS/Dynamics). 400K+ companies, 2,500+ teams, 77.8M+ cards, EU–US DPF + UK/Swiss. **No NFC hardware, no AI notetaker.** | Free · Pro **$6/mo** · Business **$5/user/mo** (5–100 users) · Enterprise custom | **D — most credible direct rival to Blinq**; wins the brand/marketing budget and compliance paperwork |
| **Linq**                  | Pivoted in 2025 to **messaging APIs** (iMessage/RCS/SMS/Voice) for agents; raised **$20M Feb 2026**. Legacy card hardware still sold, plans no longer published. 554 G2 reviews, 4.8.                                                                                                                                                                                  | Legacy ~$12.99–29.99 hardware                                                    | **Exit / migration demand** — orphaned base actively targeted by rivals                               |
| **Mobilo**                | NFC hardware + event capture: one-tap lead-gen mode, custom questions, offline auto-sync, enrichment, **live rep/booth dashboards**, leaderboards, ICP scoring, campaign attribution. 1M+ cards, 60K+ teams.                                                                                                                                                           | Hardware $19.99–$139; team **$4/user/mo** (unlimited users)                      | **D** — cheapest team model + real booth ops; thin review base                                        |
| **Dot**                   | Design-led premium NFC (dot.card/thin/classic/band/metal/wallet/**display**); Profile+ adds AI card scanner, contact map, CSV export; Teams adds CRM. **No badge capture, no campaigns.**                                                                                                                                                                              | Device ~$30; Profile+ **$12–15/mo**; Teams **$8/member/mo**                      | **A** — hardware desire, not event depth                                                              |
| **Haystack**              | Enterprise corporate cards; **unlimited AI card scanning on all tiers incl. free**; HRIS/Entra/SSO/OIDC, SOC 2.                                                                                                                                                                                                                                                        | Free · Pro **$4.50** · Business **$2.50/user/mo** · Enterprise custom            | **D (enterprise)** — cheapest credible enterprise path; no event retrieval                            |
| **V1CE**                  | Pay-once NFC (from £59.99), **free software for life**, optional **Client Capture OS £49.99/mo**; **Scout** + **Co-Work** AI agents (briefs, job-change alerts, notetaker). 510K+ members, profitable, no VC.                                                                                                                                                          | Card £59.99; OS £49.99/mo                                                        | **D** — hardware craft + agent packaging; no SOC 2                                                    |
| **Tap (gettap.co)**       | Card + **badge/paper/QR scan** + 20+ enrichment + **AI meeting notes** (objections, buying signals, talk ratio) + lead scoring + CRM incl. **Veeva Vault**; team admin. 200K+ users.                                                                                                                                                                                   | **$2.80 / $4.20 / $14 per seat/mo**                                              | **D — closest feature set to the RevenueHero thesis**; strongest price-per-lead                       |
| **Wisery**                | Link-in-bio cards + wallet; **no event capture**, no enrichment, no CRM.                                                                                                                                                                                                                                                                                               | ~**$3–6/user/mo**                                                                | **A** — price-floor nuisance                                                                          |
| **Cardly** (mycardly.app) | Early-stage design-forward card; **no scanning, no CRM**; physical cards "coming soon".                                                                                                                                                                                                                                                                                | **$3.99/mo**                                                                     | **Watch** — pre-PMF                                                                                   |
| **Knowee**                | Spanish card app: OCR scan, contact exchange, wallet; free NFC card at ~€24/yr.                                                                                                                                                                                                                                                                                        | ~€24/yr                                                                          | **A** — regional SMB                                                                                  |
| **Uniqode**               | QR platform + team cards; badge/card scanning, contact manager, provisioning; **SOC 2 + HIPAA + ISO + GDPR** (broadest compliance).                                                                                                                                                                                                                                    | Free · Team **$6/user/mo** · Business+ custom                                    | **A/P** — compliance wedge                                                                            |
| **Sansan**                | Japan; enterprise contact-management leader by revenue.                                                                                                                                                                                                                                                                                                                | Quote                                                                            | **A** — not an event rival                                                                            |
| Also                      | Spreadly (EU, GDPR-first), Tapni, Piper Card, Lynkle, BizLinker, RepCard, TradePass, Mobly                                                                                                                                                                                                                                                                             | varies                                                                           | long tail                                                                                             |

**Digital-card competitive map (Segment A)**

|                     | Blinq         | HiHello       | Popl      | Mobilo        | Dot          | Haystack      | Wave          | Uniqode        | V1CE         | Tap           |
| ------------------- | ------------- | ------------- | --------- | ------------- | ------------ | ------------- | ------------- | -------------- | ------------ | ------------- |
| Model               | freemium/seat | freemium/seat | quote     | hardware+seat | hardware+sub | freemium/seat | freemium/seat | freemium/seat  | hardware+sub | freemium/seat |
| Entry team price    | $4.99         | $5            | quote     | $4 + cards    | $8           | $2.50         | $5            | $6             | £49.99/mo    | $2.80         |
| NFC hardware        | ✅            | ❌            | ✅        | ✅✅          | ✅✅         | ✅ (partner)  | ✅            | ❌             | ✅✅✅       | ✅✅          |
| Badge scan          | ✅✅          | ✅            | ✅✅      | ✅            | ❌           | ❌            | ✅            | ✅             | ✅           | ✅✅          |
| Offline capture     | ✅ auto       | ✅            | ✅ manual | ✅            | ✅ share     | ✅            | ✅            | ❌             | ✅           | ✅            |
| Enrichment          | ✅✅ 25+      | ✅            | ✅✅      | ✅            | ❌           | ❌            | ✅            | ❌             | ✅           | ✅ 20+        |
| AI notetaker        | ✅✅          | ❌            | ✅ (2026) | ❌            | ❌           | ❌            | ❌            | ❌             | ✅           | ✅✅          |
| Event campaigns/ROI | ✅✅          | ✅            | ✅✅      | ✅✅          | ❌           | ❌            | ✅            | ❌             | ✅           | ✅            |
| Native CRM breadth  | ✅✅          | ✅            | ✅✅      | ✅            | ✅ (Growth)  | ✅ (Zapier)   | ✅            | ✅             | ✅           | ✅✅ (Veeva)  |
| SOC 2               | ✅            | ✅            | ✅        | ?             | ❌           | ✅            | ✅            | ✅ + HIPAA/ISO | ❌           | ?             |

**Who beats Blinq where (and what a new entrant should exploit)**

| Battlefield                | Who wins                                                                           | Why                                                                                     | Blinq's exposure                            |
| -------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Cost per captured lead** | Tap ($4.20 all-in), HiHello (in-seat), Popl (flat), Wave ($0 on failed enrichment) | Blinq charges **$9.99/lead** on top of seats, plus **0.75 credit on failed enrichment** | **Highest severity** — one slide kills it   |
| **Brand/marketing buyer**  | HiHello                                                                            | Signature + banner campaigns + backgrounds + directory + DPF                            | Different budget line                       |
| **Event-ops depth**        | Popl, iCapture, Captello                                                           | Booth/floor analytics, organizer relations, badge printers, CSM                         | Blinq is exhibitor-side only                |
| **Hardware desire**        | V1CE, Dot                                                                          | Metal/bamboo/gold, lifetime replacement                                                 | Blinq's NFC range is thin                   |
| **Regulated industries**   | Uniqode (HIPAA/ISO), Tap (Veeva), Sansan                                           | Certification breadth                                                                   | Blinq stops at SOC 2 + GDPR                 |
| **Free-tier generosity**   | Wave, Haystack, HiHello                                                            | Analytics + export free; unlimited scans free                                           | Blinq adds branding and solicits recipients |
| **Enterprise procurement** | HiHello, Sansan                                                                    | SAML/SCIM + DPF + invoice/PO/multi-year                                                 | Blinq's Enterprise is newer                 |
| **CRM-native "free"**      | HubSpot/Salesforce native scanners                                                 | Already paid for                                                                        | Default SMB objection                       |

### E14. Event platforms with native capture `[PLATFORM]`

- **Cvent** — full stack; owns LeadCapture + iCapture + Jifflenow; **median
  ~$19,550/yr**; no first-party MCP.
- **Swoogo** — registration/data platform; **native MCP (6 Apr 2026)**, free
  through Summer 2026; **from $11,800/yr**.
- **Bizzabo** — Klik SmartBadge (wearables; claims 389% more exhibitor leads);
  **$499/user/mo, 3-user min = $17,999/yr**; Klik works with third-party
  platforms.
- **Whova** — event app + lead retrieval module; quote-only (~$1.5k–$2.5k/event
  estimates).
- **RainFocus** — enterprise flagships; **MCP Profiles (8 Jul 2026), 123
  tools**; KKR-backed; quote-only.
- **Others:** PheedLoop, ADITUS (261-tool MCP), vFairs (read-only MCP),
  Eventtia, Expo Pass, Grip, Swapcard, Eventbrite (being acquired by Bending
  Spoons ~$500M).

### E15. Routing / scheduling / enrichment adjacents `[ROUTING][SCHEDULING][ENRICH]`

- **Chili Piper** — Routing & Scheduling **from $15,000/yr** (15 seats, annual
  only); Distro + Concierge + Handoff + ChiliCal; MCP; already claims trade-show
  scheduling.
- **Calendly** — Free / $10 / $16 per seat; Enterprise from $15k (50-seat min);
  Routing + Callie + MCP.
- **LeanData** — Salesforce-native orchestration + BookIt; quote-only (~$18k+/yr
  est.); BookIt MCP.
- **Default** — agentic GTM (routing + scheduling + enrichment); $20M raised;
  seat-based self-serve.
- **Qualified (Piper)** — AI SDR; ~$42k–$68k/yr; now Salesforce-owned.
- **RevenueHero** — $25–35/user/mo + $79/mo platform fee; explainable routing +
  booking; 550+ customers; native enrichment waterfall
  (Clearbit/Apollo/Crustdata).
- **Enrichment:** Clay ($185–$495/mo), Apollo ($49–$119/seat), Crustdata
  ($0.005–$0.28/record), ZoomInfo (~$14,995/yr), Common Room (now Zoom-owned,
  $266.8M).

### E16. Long-tail adjacents `[ADJACENT]`

**Field / outside sales.** Badger Maps
($58–95/user/mo; route planner + CRM + **card scanner + MCP**), SalesRabbit ($49–59),
SPOTIO (quote, 5-seat min), Repsly (quote, 12-month min), Map My Customers
($99–199/user/mo), ForceManager → **Sage Sales Management** (~$19–42.50;
acquired Oct 2024), Zoho CRM (free 3 users). _Read: least event-aware; Badger
already bolts a card scanner onto a route planner — capture is a feature, not a
product. Nobody connects "I'm at a conference in this city" to territory/route
planning._

**AI notetakers / conversation capture.** Granola
($14–35/user/mo; bot-free), Limitless (ex-Rewind; **acquired by Meta**; pendant no longer sold; free), Plaud (hardware **$159–189** +
**$17.99–29.99/mo**; 3M+ users), Otter ($16.99–30), Fireflies
($10–39), Fathom ($15–34), tl;dv ($18–39), Gong (quote; ~$1,300–1,600/user/yr +
platform), Chorus (ZoomInfo). _Read: they own audio, not identity or
availability. None knows who the person is (badge/LinkedIn/CRM) or whether
they're bookable this week._

**Personal CRM / contact management.** Covve ($12–20/seat/mo +
$6 CRM; **already sells event badge scanning**), Dex ($12–40), **Mesh**
(ex-Clay; free–$20; renamed Mar 2026), Cloze ($17–42), UpHabit (**shut down Apr
2026**), Monica (free/self-host). _Read: the price floor for "remember every
person" is $12–20; Covve is attacking our category from below at ~1/5 enterprise
event pricing._

**Event networking / matchmaking.** Brella (quote), **Grip** (AI networking +
lead gen; quote), **Swapcard** (matchmaking + **exhibitor lead capture** +
hardware; quote), Eventtia ($1,250–1,500/yr), PheedLoop (from $950/yr +
$1/attendee), **Expo Pass** (from $2,495; lead retrieval), Eventbrite (3.7% +
$1.79/ticket; **being acquired by Bending Spoons ~$500M**), Webex Events
(quote), Airmeet (~$167–199/mo). _Read: organizer stacks already sell lead
capture — as a booth feature (scan → exhibitor portal → CSV), not as seller CRM
hygiene or a booked meeting. They stop at the show's edge._

**Scheduling / routing adjacents.** Cal.com (free / $12–28), SavvyCal ($10–17),
TidyCal
($29 lifetime), Revenue.io (quote), **Distribution Engine** ($20–55/user/mo +
Booking Engine from
$10), Qualified (quote; now Salesforce), RevenueHero ($79/mo + $25–35/user).

**Enrichment / signals.** Clay ($167–446/mo), Apollo ($49–119/seat), Crustdata
($20 credits + $0.005–$0.28/record), ZoomInfo
(~$33.5k median), Common Room ($2,500/mo; now Zoom), Pocus (→ Apollo Mar 2026),
Unify ($20–60/seat).

**Convergence map**

| Layer             | Who owns it today                                                | Who is moving in                                |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| Capture           | Popl, HiHello, V1CE, Covve, Tap, Expo Pass, PheedLoop, Swapcard  | Notetakers (Plaud), field apps (Badger)         |
| Identity/contacts | Personal CRMs (Dex, Cloze, Mesh), HubSpot/Salesforce             | Card apps (Covve)                               |
| Enrichment        | Clay, Apollo, ZoomInfo, Crustdata, Common Room                   | Capture vendors (Popl, HiHello)                 |
| Routing           | RevenueHero, Chili Piper, LeanData, Default, Distribution Engine | CRM suites (Distribution Engine Booking Engine) |
| Booking           | Calendly, Cal.com, Chili Piper, RevenueHero                      | Capture vendors (V1CE "Capture OS", Tap)        |
| Attribution       | Event platforms (Cvent, Swoogo, Bizzabo, Grip, Swapcard)         | **Nobody rep-side**                             |

**Four convergence clusters:** (1) card → in-person GTM platform (Popl, HiHello,
V1CE, Tap); (2) notetaker → CRM writer (Fathom, Fireflies, tl;dv, Otter, Gong);
(3) signal vendor → execution platform (Apollo+Pocus, ZoomInfo+Copilot,
Salesforce+Qualified); (4) organizer → exhibitor lead-gen (Swapcard, Grip, Expo
Pass, PheedLoop). Each starts from a different point and **misses a different
quarter of the loop**.

**White space (ranked by "evidence it hurts today" × "nobody owns it")**

- **W1. The rep's show-day workflow, not the organizer's show.** Which sessions,
  which 12 people, which booth shift, who else from my team is here, what must
  be followed up before the flight home. Nobody owns it; it ends in a booking.
- **W2. Book on the floor, with the right person, before the moment cools.**
  Scan → identify account → check AE availability → book at the show or next
  week, with routing/fairness. Capture exports CSV; scheduling waits for a
  click.
- **W3. Identity resolution with a confidence score and audit trail.** Today the
  rep gets a "lead" with no provenance and re-keys it.
- **W4. Event → pipeline attribution at rep/booth/shift level.** Every platform
  reports scans; none ties a scan to opportunity/stage/closed-won per rep.
- **W5. Consent + EU/UK privacy as a feature.** Badge scanning and recording are
  personal-data processing; consent capture, retention, DSAR, audit log unlock
  DACH/NL/UK procurement.
- **W6. One map for field + events.** Field apps route visits; event tools know
  the show. A rep in a new city for a conference is doing both.
- **W7. The $20–50/seat self-serve gap.** Below Chili Piper ($15k floor) and
  Cvent/Swapcard (enterprise), above $0–6 card apps. Popl is quote-only; HiHello
  is $5 but shallow; Covve is $20 + $6 CRM.
- **W8. MCP-native capture.** No capture vendor exposes "scan → enrich → check
  availability → book" as an agent-callable tool. Badger ships an MCP server for
  field data; capture does not.

---

## F. The decisions hidden behind a feature checkbox

- **F1. Capture accuracy is a range, not a boolean.** No vendor publishes
  measured OCR accuracy; "99%" is enrichment match rate, not field accuracy. A
  product that publishes accuracy-by-badge-type and a verification queue at low
  confidence owns the trust narrative.
- **F2. "Offline" hides a queue design.** Does capture persist, does enrichment
  queue, does CRM write happen offline (usually not), and does sync require
  reopening the app (often yes)?
- **F3. "CRM sync" hides dedupe and ownership policy.** Email-keyed vs
  admin-defined matching, create-vs-update, and whether the CRM's own assignment
  rules overwrite the router's decision.
- **F4. "Booking" hides who owns the decision.** When capture tools "book," the
  logic often lives in Chili Piper/Calendly — the capture tool owns the prompt,
  not the routing.
- **F5. "Attribution" hides the model.** Every vendor invents a metric
  (Leads-to-Meeting, cost per booked meeting, pipeline influenced, event ROI);
  none is auditable or comparable.

---

## G. What this changes for RevenueHero

- **G1. The product is the connective tissue, not a scanner.** Own capture →
  route → **book** → attribute (D01+D02+D10+D12) across arbitrary shows. Capture
  is commoditising; booking + attribution is the durable value.
- **G2. Sell the gap, not the scan.** The most repeated pain is the 3–7 day lag
  from scan to SDR action. Lead with "booked before they leave the booth."
- **G3. Price for the empty cell.** Public pricing + unlimited scans + CRM
  sync + booking, in the **$1.5k–$6k/yr** band that neither the free scanners
  nor the $8k+ platforms serve. Never a per-scan fee.
- **G4. Be waterfall-agnostic.** Copy Cvent's "bring your own ZoomInfo" posture;
  attribute the source; never resell data you didn't originate.
- **G5. Exhibitor-side first.** The exhibitor pays and owns the lead; the
  organizer is unaffected. Then sell the organizer the aggregate analytics
  layer.
- **G6. Make the audit trail a product.** Show the decision — which scan, which
  field, which rule, which rep, which slot, which outcome. This defends against
  both free scanners (no logic) and platforms (no cross-vendor neutrality).
- **G7. Ship MCP early and publish write-safety.** Only ~8 organizer-side
  vendors had an MCP server by Aug 2026 and Cvent had none; nobody had run a
  write against a live event. A published read/write split + annotated
  destructive tools is an enterprise selling point.

---

# Part II. Comparative evidence and operational diligence

## 1. Executive conclusions

**The product decision.** Build the **capture → route → book → attribute** layer
for in-person GTM, priced in the empty mid-market cell, with an explainable
audit trail and a consent-first recording posture. Do **not** build a scanner.

**Seven findings that should change the plan.**

1. **Capture is commoditising toward free** (Vendelux $0, Wave £60/user/yr, DIY
   ~£1,128/yr). Price on the routing decision and the booking, not scans.
2. **Cvent already does capture + route + book** (iCapture + Jifflenow) as an
   add-on inside a platform deal (~$19.5k median). Beat it on speed, neutrality,
   and price — never breadth.
3. **The routing vendors are entering events** (Chili Piper lists trade-show
   scheduling) but their **$15k floor / 15-seat minimum** leaves the
   sub-15-seat, event-only budget unserved.
4. **The must-have is gated everywhere** — CRM sync is Enterprise-only at
   BoothIQ, an add-on at Momencio, $3k/yr at Captello, Business-tier at Blinq.
   Including it at a fair price is a wedge.
5. **No vendor publishes capture accuracy.** Trust is the unclaimed moat.
6. **Consent for AI recording is unowned.** Five vendors record booth
   conversations; none shows a consent architecture, while the EU enforces (CNIL
   fined KASPR €240k).
7. **MCP is distribution, not revenue (yet).** Ship it early; differentiate on
   write-safety.

**Competitive positions, not an unsupported league table.** Cvent leads on scale
and consolidation; RainFocus leads enterprise flagships; Chili Piper/LeanData
lead routing; Captello/Momencio lead feature depth; Vendelux leads price;
Blinq/Popl lead brand. **Nobody leads the connective tissue.**

## 2. Evidence standard and how to use this report

**What each kind of evidence establishes.**

| Evidence                     | Establishes                     | Does not establish                       |
| ---------------------------- | ------------------------------- | ---------------------------------------- |
| Vendor pricing/features page | Advertised scope and price      | Negotiated terms; real-world reliability |
| Vendor docs                  | Intended behaviour              | That it works under load                 |
| Third-party (Vendr/G2)       | Independent price/review signal | Causality or current state               |
| Review/community post        | A real user's friction          | A universal defect                       |
| Market-size reports          | Directional magnitude           | A defensible TAM                         |

**Guardrails against misleading comparisons.** Compare _complete workflows_, not
toggles; reconfirm every price at quote time; treat vendor "year in review"
numbers as marketing; distinguish a **claim** from a **verified** fact.

**Scope boundaries.** This report does not rank vendors by total cost, does not
assert measured performance, and does not treat one review as a product truth.

## 3. Market map and product boundaries

**Four buying problems that get called "lead capture."**

| Buying problem         | Unit being routed          | Relevant players                        | Boundary to preserve    |
| ---------------------- | -------------------------- | --------------------------------------- | ----------------------- |
| Networking             | Person/contact             | Blinq, HiHello, Popl, Linq              | Not pipeline            |
| Booth capture          | Person + event             | Popl, Wave, BoothIQ, Vendelux, iCapture | Speed + dedupe          |
| Event pipeline         | Person + account + meeting | Captello, Momencio, B2Brain, iCapture   | Routing + booking + ROI |
| Pre-event intelligence | Account/attendee           | Vendelux, Popl, Cvent                   | Data quality            |

**Market size (directional).** Event management software ~$16B growing ~10–13%;
**event lead capture specifically only ~$746M–$2.8B at 5–8% CAGR**. The real
pool is routing + booking + attribution _inside_ event budgets.

## 4. Capability comparison matrix

**Panel A — event lead capture platforms**

| Capability            | Popl      | Blinq         | Wave        | BoothIQ        | Vendelux       | Captello     | Momencio   | iCapture     |
| --------------------- | --------- | ------------- | ----------- | -------------- | -------------- | ------------ | ---------- | ------------ |
| Universal badge scan  | ✅        | ✅            | ✅          | ✅             | ✅             | ✅           | ✅         | ✅           |
| Offline capture       | ✅        | ✅            | ✅          | ✅             | ✅             | ✅           | ✅         | ✅           |
| Enrichment waterfall  | ✅        | ✅            | ✅          | ✅             | ✅             | ✅(125+)     | ✅         | ✅(BYO)      |
| Custom qualifiers     | ✅        | ✅            | ✅          | ✅             | ~              | ✅           | ✅         | ✅           |
| CRM sync included     | ✅(ELC)   | Business tier | Teams       | **Enterprise** | HubSpot        | +$3k HubSpot | **Add-on** | ✅           |
| Meeting booking       | ✗ (link)  | ✗             | coming      | ✅ (AI)        | ✗              | ✅           | ✅         | ✅ (in-flow) |
| Routing logic         | ✗         | ✗             | ✗           | ✗              | ✗              | partial      | ✗          | ✅ (rules)   |
| Conversation capture  | ✅        | ✅            | voice notes | ✅             | voice notes    | ✅           | ✅         | ✗            |
| Event ROI attribution | ✅        | ✅            | ~           | ~              | ✅             | ✅           | ✅         | ✅           |
| Public pricing        | ✗         | ✅            | ✅          | ✅             | ✅             | partial      | ✅         | ✗            |
| Free tier             | card only | no scanning   | 10 credits  | **full**       | **everything** | Connexions   | no trial   | no           |

**Panel B — routing / scheduling / platform adjacents**

| Capability              | Chili Piper | Calendly | LeanData   | Default | Cvent   | RevenueHero  |
| ----------------------- | ----------- | -------- | ---------- | ------- | ------- | ------------ |
| Inbound routing         | ✅          | ✅       | ✅         | ✅      | ✅      | ✅           |
| Weighted round-robin    | ✅          | ~        | ✅         | ✅      | ~       | ✅           |
| Territory/named account | ✅          | ✗        | ✅         | ✅      | ~       | ✅           |
| Native booking          | ✅          | ✅       | ✅(BookIt) | ✅      | ✅      | ✅           |
| Badge/card capture      | ✗           | ✗        | ✗          | ✗       | ✅      | ✗            |
| Event attribution       | ~           | ✗        | ✗          | ✗       | ✅      | ~            |
| Explainable audit trail | ✅          | ~        | ✅         | ✅      | ~       | ✅           |
| Public entry price      | $15k/yr     | $10/seat | ~$18k/yr   | seat    | ~$19.5k | **$25/seat** |
| MCP                     | ✅          | ✅       | ✅         | ✅      | ✗       | ✅           |

**Read:** nobody fills the row "capture + routing + booking + attribution +
public mid-market pricing."

## 5. Competitor dossiers (detailed)

### 5.1 Blinq

"AI contacts platform for the real world." Cards + event lead capture +
universal scanner (badge/card/QR/LinkedIn, auto-offline) + AI enrichment (25+
providers) + AI Notetaker + Event Badges + campaigns/ROI + Ask Blinq MCP. Native
CRM: Salesforce, HubSpot, Dynamics, GoHighLevel, Zoho, Monday, Marketo. Pricing:
Free · Premium $7.33/mo · Business $4.99/user/mo **+ $9.99/lead** · Enterprise
custom. $28.5M raised, HubSpot Ventures; 4M users, 93% Fortune 500 claim, G2 4.8
(9,345). _Strengths:_ distribution, activation, HubSpot depth, MCP, per-lead
transparency. _Weaknesses:_ per-lead cost, failed-enrichment charge, no
routing/booking, thin NFC range, no organizer motion. See `blinq-profile.md`.

### 5.2 Popl

"In-person GTM platform." Universal badge scanner, card/LinkedIn QR, enrichment
waterfall, event campaigns, qualifiers/completion, **AI Voice** (recorder, note
taker, qualification agent, voice-to-email), Ask Popl MCP, digital cards.
Pricing: Free/Pro $7.99/Pro+ $14.99; teams **quote-only** (Vendr median
~$17,500/yr). YC-backed; G2 4.6 (6,511); 90% Fortune 500 claim. _Strengths:_
brand, enrichment, AI Voice, enterprise onboarding. _Weaknesses:_ price opacity,
contract size, booking is a Chili Piper link. See `../popl/features.md`.

### 5.3 HiHello

"Professional Presence and Lead Capture Platform." Cards + **email-signature
manager with banner campaigns** + backgrounds + company directory + universal
scanner (5/20/50 scans/mo) + enrichment + lead forms + CRM. Pricing: Free · Pro
$6 · Business $5/user (5–100) · Enterprise custom. 400K+ companies, 2,500+
teams, DPF/UK/Swiss. _Strengths:_ brand/marketing buyer, compliance paperwork,
in-seat scan pricing, design depth. _Weaknesses:_ no NFC hardware, no AI
notetaker, SAML/SCIM Enterprise-only, scan caps.

### 5.4 Wave Connect

"Pay for leads, not seats." Badge/card/LinkedIn scanner, waterfall enrichment,
offline, qualifiers + voice notes, event tagging, CRM sync, SOC 2, SSO/SCIM
Enterprise. Pricing: Free · Pro $7/mo · Teams
$5/user + credits · **$2.50/credit, badge = 4 credits ($10)** · Enterprise
custom. _Strengths:_ transparency, PLG funnel, credit model, no-charge on failed
enrichment. _Weaknesses:_ badge meter punishes the highest-value action, no
booking yet, small vendor, Android TWA.

### 5.5 BoothIQ

AI badge/card/LinkedIn scan, multi-badge, handwritten notes, offline,
enrichment, voice notes + AI summaries, AI follow-up drafts, leaderboard; CRM
sync Enterprise-only. Pricing: Individual **free** · Team **$999/mo** (was $499
in Jun 2026) · Enterprise custom. _Strengths:_ free tier, feature trio,
month-to-month. _Weaknesses:_ CRM sync gated, price doubled, single founder, no
SOC 2.

### 5.6 Vendelux Lead Scanner

Free universal badge/card/handwritten scanner, enrichment, lead temperature,
typed/voice notes, offline, HubSpot one-tap sync (Salesforce planned), CSV.
Pricing: scanner **$0**; platform quote-only. **$50M Series B (Jul 2026)**, $71M
total. _Strengths:_ price anchor, pre-event intelligence, content engine.
_Weaknesses:_ capture is a funnel, Salesforce lag, enterprise posture unproven.

### 5.7 Captello

"Event-to-revenue intelligence." IntelliScan, 5-layer enrichment (125+),
conversation intelligence, behavioural re-ranking, document library,
routing/fulfillment, 60+ gamified activations, 365 off-floor, meeting scheduler,
Connexions card. Pricing: **from $500/event** + badge kits $736–1,330/show +
HubSpot $3k/yr. Inc. 5000 No. 121 (2026). _Strengths:_ deepest surface,
unlimited users/event, service. _Weaknesses:_ unpredictable invoice, no pricing
page, learning curve.

### 5.8 Momencio

Universal capture, AI EdgeCapture, AI IntelliSense (sentiment/ICP/scoring/
summaries), LiveMicrosites, content library, in-app booking, follow-up
campaigns, kiosk, dashboards. Pricing: Capture $7,500/yr · Engage $10,300 ·
Amaze $13,700; **12-month non-cancellable, no trial, 5-seat min**, CRM add-on.
_Strengths:_ content-led workflow, published pricing. _Weaknesses:_ harshest
terms, badge API dependency, add-on pricing.

### 5.9 iCapture (Cvent)

Exhibitor-owned universal capture: badge/card/photo/manual, **130+ badge
providers**, validation + BYO-ZoomInfo enrichment, AI email prediction, Apollo
firmographics, rule-based routing, **in-flow Calendly/HubSpot booking**,
offline. Pricing: **from ~$8,000/yr**; Cvent LeadCapture $249/device.
_Strengths:_ clean-data story, widest badge coverage, in-flow booking, Cvent
distribution. _Weaknesses:_ $8k floor, annual contract, brand absorption,
enrichment dependency.

### 5.10 Zuant

Enterprise branded capture: barcodes/NFC, weighted scoring forms, Showroom, Data
Vault (GDPR), Cloud reporting, **Zuant AI** enrichment, Zuant 3D. Pricing:
**none published** (demo; 3-show guarantee). _Strengths:_ customisation,
offline, EU compliance, references. _Weaknesses:_ zero price transparency, dated
UX, low momentum.

### 5.11 SnapAddy

CRM-data-quality suite: **VisitReport** (event/field capture, badge provider,
media library, offline, kiosk, Voice AI), BusinessCards, LeadResearch,
DataAgents. Pricing: BusinessCards €36–60/yr · **VisitReport €348/yr/user** ·
Enterprise named/concurrent/terminal; CRM mapping add-on. 4,000+ customers, DACH
industrial. _Strengths:_ cheapest credible capture, CRM depth, European
compliance. _Weaknesses:_ capture is a feature, no attribution/booking, weak US.

### 5.12 B2Brain

"Leads-to-Meeting." Badge/card scan, voice/text notes, real-time ICP scoring,
**on-the-spot dual calendar invite with round-robin/territory routing**, auto
deal creation, SF/HS real-time sync, offline iOS, per-event ROI, show-over-show
memory. Pricing: Show Pass or Pipeline; claims <$125/user/event, first event
free for two. _Strengths:_ best outcome metric, booking-before-they-leave,
industrial verticals, content. _Weaknesses:_ iOS-only, small, no SOC 2, lighter
enrichment.

### 5.13 Digital-card cluster (Mobilo, Dot, Haystack, V1CE, Tap, HiHello)

See §E13 for the full map. Short form: **Mobilo** = cheapest team + booth ops;
**Dot** = design/hardware, no event depth; **Haystack** = cheapest enterprise,
no retrieval; **V1CE** = pay-once hardware + agent packaging; **Tap** = closest
feature set ($4.20/seat badge scan + AI notes + Veeva); **HiHello** = brand/
compliance buyer.

### 5.14 Long-tail card cluster (Linq, Wisery, Cardly, Knowee, Uniqode, Sansan)

**Linq** pivoted to messaging APIs (orphaned base = migration demand);
**Wisery** and **Cardly** are link-in-bio price-floor players; **Knowee** is
regional with a free-NFC hook; **Uniqode** has the broadest compliance (SOC
2/HIPAA/ISO/GDPR); **Sansan** is the Japan enterprise leader by revenue.

### 5.15 Personal CRM (Covve, Dex, Mesh, Cloze, UpHabit, Monica)

Covve is the one to watch: it already sells **event badge scanning** + team CRM
sync at $20/seat. Dex and Cloze are individual relationship tools. Mesh
(ex-Clay) and Monica are privacy/consumer plays. UpHabit shut down Apr 2026 →
users in market.

### 5.16 Notetakers (Granola, Plaud, Otter, Fireflies, Fathom, tl;dv, Gong, Chorus)

They own the audio and are racing to write CRM. Plaud is the hardware wildcard
(3M+ users, $159–189 device, already markets "in-person, phone and online").
None owns identity or availability — a capture product can consume their output.

### 5.17 Organizer / networking (Grip, Swapcard, Brella, Expo Pass, PheedLoop, Eventtia)

They sell matchmaking to organizers and lead retrieval to exhibitors, and they
stop at the show's edge. **Grip and Swapcard are the best partner targets**
(attendee graph + exhibitor distribution). **Expo Pass/PheedLoop** are the SMB
badge-printing rail.

### 5.18 Routing / scheduling (Chili Piper, Calendly, LeanData, Default, Qualified, RevenueHero)

Chili Piper ($15k floor, 15 seats, annual), Calendly ($10–16/seat), LeanData
(~$18k+, Salesforce-native, BookIt), Default (agentic, seat-based), Qualified
(~$42–68k, now Salesforce), RevenueHero ($25–35/seat + $79/mo, explainable
routing + booking). **These own the booking layer the capture vendors lack.**

### 5.19 Enrichment (Clay, Apollo, Crustdata, ZoomInfo, Common Room)

Supply chain, not competitors. Be waterfall-agnostic: Clay for orchestration,
Crustdata for real-time/cheap unit economics, Apollo/ZoomInfo for coverage,
Common Room for signals. Attribute the source; never resell data you didn't
originate.

## 6. Capability catalog: basics through advanced operation

This is a requirements checklist, not a claim that every vendor implements every
item. It decomposes "capture" so a good demo cannot hide a weak workflow.

### 6.1 Capture and identity

| Area                | Baseline requirement                  | Advanced behaviour / failure mode                                                      |
| ------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| Badge capture       | OCR or decode on common badge formats | Encrypted/registration-ID badges fail without organizer kit; no published accuracy     |
| Card capture        | Paper card OCR                        | Glossy/low-contrast cards degrade; failed enrichment still billed at some vendors      |
| QR / LinkedIn       | Decode + resolve                      | No official LinkedIn API; relies on public URL + enrichment                            |
| Offline             | Capture persists without Wi-Fi        | Queue may require reopening the app; CRM writes never offline; device loss = data loss |
| Identity resolution | Name + company → contact              | No confidence score; duplicate people merged silently or not at all                    |
| Duplicate handling  | Re-scan not double-counted            | Cross-rep and cross-show dedupe is usually weak                                        |
| Consent             | Notice at capture                     | Most tools bury it in ToS; recording consent is rep-enforced with no audit artefact    |

### 6.2 Enrichment, qualification and routing

| Area           | Baseline requirement                     | Advanced behaviour / failure mode                                                      |
| -------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Enrichment     | Waterfall → verified email/LinkedIn      | Provider coverage varies; "99%" is match rate, not accuracy; source not attributed     |
| Qualification  | Custom questions, required vs completion | Dynamic branching usually single-select, one layer deep                                |
| Owner matching | Match to CRM account owner               | Domain collisions (subsidiaries/agencies) attach the wrong account, no disambiguation  |
| Territory      | Region/segment rules                     | Stale owners, duplicate rules, manual CSV maintenance                                  |
| Distribution   | Round-robin, weighted, caps              | Weights are often ratio/level, not explicit %; fairness disputes; OOO not auto-handled |
| Fallback       | Designed backup path                     | Most tools drop silently; no "why no one got it" explanation                           |
| Explainability | Show the rule that fired                 | Rare; logs often record outcome, not reasoning                                         |

### 6.3 Booking, attribution and compliance

| Area                          | Baseline requirement                       | Advanced behaviour / failure mode                                                  |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Availability                  | Real slots from rep calendars              | OOO/timezone/buffer errors; double-booking                                         |
| Book-on-behalf                | Rep books the right AE                     | Booking logic often lives in Chili Piper/Calendly, not the capture tool            |
| Reschedule / cancel / no-show | Self-serve + outcome tracking              | Self-reported "did you book?"; no two-way calendar sync; no-show not credited back |
| CRM sync                      | Real-time, field-mapped, deduped           | CRM assignment rules overwrite router; blocked leads absent from logs              |
| Event attribution             | Scan → CRM → pipeline                      | Modelled pipeline (ACV × conversion) presented as real; no per-rep/shift view      |
| Audit trail                   | Scan → field → rule → rep → slot → outcome | Almost never end-to-end                                                            |
| Security                      | SOC 2, SSO/SCIM, DPA, residency            | US-only residency common; consent/processing legality separated from security      |
| AI recording                  | Transcribe/summarise/extract               | 30-min caps, no consent architecture, no retention controls                        |

## 7. APIs, reliability and integration failure modes

- **Compare API surfaces independently** — capture API vs routing API vs booking
  API vs MCP. Published request limits are not measured throughput.
- **Failure families to design for:** stale/conflicting CRM state; fairness
  races in round-robin; partial effects (ownership ok, Slack fails);
  provider/credential failures; system-of-record drift; bulk work starving live
  traffic.
- **Enterprise checks:** DPA, subprocessor list, residency, audit retention,
  deletion/export, SSO/SCIM, tenant isolation.

## 8. UX: evaluate the work, not the canvas

- **Admin:** can a non-engineer add a territory, locate a pool, explain a
  disputed assignment, and repair a failed write without an unsafe replay?
- **Rep:** clear reason for assignment, ownership context, and safe ways to mark
  absence/decline.
- **Prospect:** preserve form data when scheduling fails; a deliberate path for
  unqualified/unavailable/empty-calendar cases.

## 9. Customer demand: requests, complaints, disposition

**Recurring themes to take into discovery:**

- **Booked ≠ held** — no-shows and double-reschedules; "booked meetings is the
  number everyone reports on."
- **Losing the lead between form and calendar** — two-step flows leak.
- **Round-robin fairness / cherry-picking.**
- **SDR→AE handoff attribution.**
- **Calendar accuracy** (OOO, timezone, buffers).
- **RevOps can't debug routing; no audit trail; admin dependency.**
- **Events** — badge scans become dead CSVs; no on-site booking; post-event
  grind.
- **Mobile gap** (RevenueHero's own G2 review flags no native mobile app).

**Claims this evidence does not support:** that most customers dislike any
specific UI, that a given vendor "has no fallback," or that challengers are
faster — none of these are established by the available evidence.

## 10. Recommended product direction for RevenueHero

**Start from the public baseline, then validate internally.** Produce an
internal capability map with four states: shipped and reusable; shipped but
meeting-specific; implemented but not customer-ready; missing.

**Proposed sequence (by operational risk):**

| Priority | Capability group                                                          | Acceptance bar                                                          |
| -------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P0       | Event object + event-scoped router + QR self-serve capture → route → book | A QR produces a routed, booked, CRM-synced meeting tagged to the event  |
| P0       | Rep mobile capture (PWA) + OCR + book-on-behalf + offline queue           | A rep captures and books the right rep's calendar offline, then syncs   |
| P1       | Event attribution + audit trail                                           | Every booking shows scan→field→rule→rep→slot→outcome                    |
| P1       | List import + pre-event intelligence                                      | An attendee list becomes ranked, matched accounts                       |
| P2       | Conversation capture (consent-first)                                      | Recording produces qualifiers + notes with explicit consent + retention |
| P2       | MCP + capture-agnostic ingestion                                          | A third-party tool/agent books through RevenueHero                      |

**Product principles with real competitive value.**

- One policy vocabulary; explicit state boundaries.
- Data tables for repeated mappings; graphs for sequencing.
- Historical truth is immutable.
- Fallback is a designed business outcome.
- Repair effects without rerolling ownership.
- Explain constraints before saving.

**What not to make the initial product depend on:** a full data-cleansing
platform, an unrestricted graph language, autonomous AI changes to production
rules, or a per-scan revenue model.

## 11. Vendor-demo and acceptance-test protocol

**Compare the same outcome under the same conditions.** Use an anonymized
fixture set with known expected outcomes: new inbound, existing customers,
duplicates, ambiguous companies, unavailable owners, out-of-hours, no-booking,
cancellation.

**Representative scenarios** (full set to be expanded): badge scan offline →
reconnect; duplicate scan of the same person; scan of an existing customer; scan
with no company on the badge; book when the matched owner is unavailable; book
across two reps' calendars; no-show credited back; CRM write failure and repair;
bulk import of 10k rows while live traffic runs.

**Metrics that support a decision:** capture accuracy (precision/recall with a
labelled set); execution correctness (accepted → decision → confirmed write);
latency (intake→decision, decision→write); fairness (target share vs actual,
excluding caps/absences); usability (time to explain an assignment); recovery
(backlog recovery, duplicate effects, time to first fix).

## 12. Pricing, packaging and procurement

**Current public signals (advertised terms; reconfirm at quote time):**

| Product     | Public signal                      | Comparison trap           |
| ----------- | ---------------------------------- | ------------------------- |
| Popl (ELC)  | Quote-only (~$17.5k median)        | Opaque; contract-sized    |
| Blinq       | $4.99/user + $9.99/lead            | Per-lead meter scales     |
| Wave        | $5/user + $2.50/credit (badge $10) | Badge meter is 4×         |
| BoothIQ     | $999/mo flat                       | CRM sync Enterprise-only  |
| Vendelux    | $0 scanner                         | Upsell to platform        |
| Captello    | $500/event + $736–1,330 kit        | Per-show compounding      |
| Momencio    | $7.5k–13.7k/yr                     | No trial, non-cancellable |
| iCapture    | ~$8,000/yr                         | Cvent sales cycle         |
| Chili Piper | $15,000/yr, 15-seat min            | Annual-only               |
| RevenueHero | $25–35/user + $79/mo               | —                         |

**A quote request that makes comparison useful:** same bill of materials for
every vendor (CRMs, objects, recipients, admins, pools, events, scans); ask what
counts as a billable event (a scan? a re-run? an enrichment attempt? a match?);
separate implementation, admin, CRM resource consumption, cleanup, and recovery.

**Decision gates:** product (segment + scope explicit); technical (passes the
acceptance scenarios; unreconciled outcomes visible); operational (a
non-engineer can explain an assignment and repair a failure); commercial (price
the complete workflow, not a per-seat headline).

---

## Evidence register

**A. Event lead capture**

- S01 Popl — pricing & features (popl.co/pages/pricing), 2026-10-22
- S02 Popl — AI Voice (popl.co/pages/ai-voice-recording)
- S03 Blinq — homepage, pricing, event lead capture, AI notetaker, event badge,
  integrations, business (blinq.me), 2026-10-22
- S04 Wave Connect — pricing (wavecnct.com/pricing)
- S05 BoothIQ — pricing (getboothiq.com/pricing); $499→$999 via ConferenceCRM
- S06 Vendelux — lead scanner (vendelux.com/lead-scanner); Series B (Jul 2026)
- S07 Captello — event lead capture; pricing via Vendelux/HubSpot Marketplace
- S08 Momencio — pricing (momencio.com/pricing)
- S09 iCapture/Cvent — cvent.com iCapture; HubSpot Marketplace; CPDE 2026 order
  form
- S10 Zuant — zuant.com (Zuant AI, Data Vault)
- S11 SnapAddy — pricing (snapaddy.com)
- S12 B2Brain — b2brain.com/platform, /pricing

**B. Platforms & adjacents**

- S20 Cvent — acquisitions (Jifflenow, iCapture, Goldcast ~$300M, ON24 $400M);
  Vendr median ~$19,550/yr
- S21 Swoogo — MCP server (PR Newswire, 6 Apr 2026); pricing
- S22 Bizzabo — Klik SmartBadge; pricing ($499/user/mo)
- S23 Whova, RainFocus (MCP Profiles, 123 tools), PheedLoop, ADITUS, vFairs
- S24 Chili Piper — pricing; Distro; MCP
- S25 Calendly — pricing; Routing; Callie
- S26 LeanData — BookIt; pricing
- S27 Default — agentic GTM; pricing
- S28 Qualified — pricing
- S29 RevenueHero — pricing; benchmark
- S30 Clay, Apollo, Crustdata, ZoomInfo, Common Room (Zoom $266.8M)

**C. Market dynamics**

- S40 Event Tech Live — lead capture landscape; MCP audit; Cvent consolidation
- S41 CNIL fine (KASPR, €240,000)
- S42 Market sizing (Grand View, Fortune Business Insights, Future Market
  Insights)

**D. First-hand crawl**

- S50 dash.popl.co app crawl (28 screenshots) — `../popl/app-crawl.md`
- S51 blinq.me crawl (8 screenshots) — `blinq-profile.md`

**E. Digital cards**

- S60 HiHello — pricing (hihello.com/pricing); Series A (Jul 2021); site metrics
- S61 Mobilo — events (mobilocard.com/events); pricing
  (mobilocard.com/pricing-2)
- S62 Dot — dotcards.net (Profile+, Teams, dot.band/display)
- S63 Haystack — thehaystackapp.com/pricing; Tracxn funding
- S64 V1CE — v1ce.co/pricing (Scout, Co-Work, Client Capture OS)
- S65 Tap — gettap.co/pages/pricing (Lead Capture $4.20, Sales Intelligence $14)
- S66 Linq — linqapp.com; TechCrunch $20M (Feb 2026)
- S67 Wisery, Cardly (mycardly.app), Knowee (know.ee), Uniqode (uniqode.com)
- S68 Blinq — comparison pages (vs Popl, HiHello, Dot, Uniqode); TechCrunch $25M
  Series A (May 2025); G2/App Store audit (Sept 2026)

**F. Long tail**

- S80 Field sales — Badger Maps, SalesRabbit, SPOTIO, Repsly, Map My Customers,
  ForceManager→Sage, Zoho (vendor pricing pages)
- S81 Notetakers — Granola, Limitless (Meta), Plaud, Otter, Fireflies, Fathom,
  tl;dv, Gong, Chorus (vendor pricing pages)
- S82 Personal CRM — Covve, Dex, Mesh (ex-Clay), Cloze, UpHabit (shutdown),
  Monica (vendor pages)
- S83 Event networking — Brella, Grip, Swapcard, Eventtia, PheedLoop, Expo Pass,
  Eventbrite (Bending Spoons), Webex Events, Airmeet
- S84 Scheduling adjacents — Cal.com, SavvyCal, TidyCal, Revenue.io,
  Distribution Engine, Qualified, RevenueHero
- S85 Enrichment — Clay, Apollo (Pocus), Crustdata, ZoomInfo, Common Room (Zoom)
- S86 Market dynamics — Event Tech Live (lead-capture landscape, MCP audit,
  consolidation); CNIL/KASPR €240k; Grand View / Fortune BI / FMI sizing

**G. Cross-checks and caveats**

- S90 G2/App Store counts were partly taken from Blinq's own Sept-2026 audit;
  re-pull before external quoting.
- S91 Vendor comparison pages are directional only — they reveal how each vendor
  frames the fight, not neutral fact.
- S92 Prices moved materially during 2026 (BoothIQ $499→$999; Cal.com closed
  source; Linq pivot; Meta/Limitless; Apollo/Pocus). Reconfirm anything older
  than ~60 days.
