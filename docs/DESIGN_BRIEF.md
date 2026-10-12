# Stash design brief (for an image-generating design AI)

Paste the text below into ChatGPT (or another image-capable AI). Bring the
images back to review against the app before anything is built.

```
You are a senior product designer who designs from human-behaviour research,
not trends. Design the mobile screens for "Stash", an app that already works.
Make realistic, high-fidelity UI images (iPhone, 393 × 852), one image per
screen, so text stays sharp. Keep words on screen short and spelled exactly.

WHAT STASH IS
Stash is a private place for the things in your life: bills, prescriptions,
photos, documents, people, places, ideas. You drop things in without thinking;
Stash remembers, connects and finds. Promise: "Capture today. Find it tomorrow."
Everything is stored on the person's own phone (no account, no company server).
Any AI the person chooses (Claude, ChatGPT, Gemini) can help, but only with
what they allow.
Live test version (example data only): https://raw.githack.com/SaiTejaVoonna/copypaster/claude/copypaster-status-update-k85h5c/index.html

WHO IT'S FOR
Everyday people in India, phone-first, busy, not technical: a parent keeping
family medical papers, someone tracking bike service and fuel, someone saving
recipes, bills and trip tickets. English UI with Indian context (₹, Indian
names and places). Calm, not "productivity hacker".

CORE CONCEPTS (keep these exact words)
- Inbox: one chat-like place where everything lands first (photo, file, text,
  scan). "Sort it later."
- Collections: topics like Health, Bike, Food, Trips, Home.
- Sections inside a collection: e.g. Health › Prescriptions, Bills, Lab Reports.
- Who / Where: people, places and things shared across collections
  (Dr Asha Verma, City Clinic, My scooter).
- Find: search by memory: when, where, who, what.
- Vault: an encrypted place for passwords and secrets. Never shared with AI.
- Connected AI: the person chooses which collections an AI may read.

DESIGN FROM HUMAN RESEARCH (each screen must apply these)
1. Capture under 2 seconds (Fogg, Tiny Habits; Risko & Gilbert on offloading):
   the camera / Snap button is the biggest, easiest thing.
2. Capture now, organise later (Kahneman: fast vs slow thinking): never force
   a choice at the moment of saving.
3. People re-find by time, place and person (William Jones, "Keeping Found
   Things Found"): search shows when / where / who chips.
4. Recognition over recall (Nielsen): suggest the likely destination; never a
   blank "where should this go?".
5. Fewer choices (Hick's law, Schwartz): show the top 3 options, not 12.
6. Thumb reach and big targets (Fitts's law): main actions at the bottom.
7. Undo instead of "Are you sure?" (Raskin).
8. Explain AI suggestions in one short line ("Because your last 4 service
   bills went here") and make correcting easy (Amershi et al., Human-AI
   Interaction guidelines; Shneiderman, Human-Centered AI).
9. Calm: one accent colour, lots of breathing space, no badges or red dots
   competing for attention, no dark patterns.
10. Progressive disclosure: a new person sees only the Inbox.

VISUAL STYLE
Dark mode first, then light versions of screens 1 and 3.
Background near-black #0d0e11; surfaces #16171c / #1c1e24; text #ececf0,
secondary #a3a6b0. One accent: violet #7b61ff. Green only for "done/synced".
Rounded but not bubbly (12–16 px corners). System font (SF Pro). Subtle depth,
no heavy gradients, no glassmorphism overload, no emoji as decoration.
Bottom dock with 5 items: Inbox · Collections · [round Snap camera button,
centre] · Search · More.

SCREENS (one image each)
1. Inbox: a photo of a scooter service bill with caption "Scooter service";
   under it a suggestion card "Bike › Service · My scooter — Because your
   last 4 service bills went here · ₹1,850 found" with buttons "File it" and
   "Somewhere else". A day label "Today". Composer at the bottom "Add to Inbox…".
2. Snap → caption: a just-taken photo of a medicine strip filling most of the
   screen, a caption field "Add a caption…", and a small "Saved" confirmation.
   Show that it is already saved; the caption is optional.
3. Find by memory: search "hospital bill last week", chips "Last week · At
   City Clinic · With Asha · Has ₹", three results each with one line saying
   why it matched.
4. Person card: "Dr Asha Verma · Dermatology · City Clinic", tiles "5 visits ·
   ₹4,200 this year · 3 weeks since last", a short timeline, and a gentle
   pattern note "Usually every 6–8 weeks (from your own visits)". No medical advice.
5. Collection: "Bike" with sections Fuel · Service · Insurance, a monthly
   total, and a timeline of entries with amounts.
6. Connected AI (Settings): "Claude — Connected"; rows "Food, Bike, Trips —
   Can read", "Health — Off", "Vault — Never", "Add to Inbox — Asks first";
   a small activity log.
7. First-run welcome: three steps (Inbox → Collections → Sync), a big "Take
   your first snap" button, and "Try an example" as a secondary link.
8. Vault: locked state with "Unlock with Face ID" and a short line that
   explains it is encrypted on this phone.

EXAMPLE DATA RULES
Only invented names (Dr Asha Verma, City Clinic, Nimrah Cafe, My scooter).
No real people, brands' logos, phone numbers or medical advice.

AFTER THE IMAGES, write for each screen:
- the 1–2 research principles it applies and how;
- anything you changed from this brief and why;
- one idea that would make it calmer or faster to use.

Check before finishing: every word spelled correctly, ₹ amounts consistent
across screens, same dock and colours on every screen, nothing clipped.
```
