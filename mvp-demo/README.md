# MVP Demo

The actual chatbot/API build goes here, separate from `docs/` (research/planning) and `data/` (pulled datasets).

Status: not started — waiting on Day 1 (2026-07-21) to confirm:
- which no-code tool the course requires
- whether we're allowed to write our own backend / call external APIs

Planned architecture (see `../docs/项目选题调研与决策.md` for the reasoning):

```
no-code tool (course-required)  ← chat UI / intent handling
        │ HTTP request / webhook
        ▼
this folder                     ← accessibility routing API (steps, elevators, fatigue model)
        │
        ▼
open data (IDFM GTFS / OSM / Paris & Île-de-France datasets)
```
