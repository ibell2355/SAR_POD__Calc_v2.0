# SAR POD Calculator — V2 Behavioral Model Roadmap

## Goal
Build a second PWA that models Probability of Detection (POD) using a simplified behavioral + modifier-based system rather than area/track-length coverage math.

This version focuses on:
- Field usability
- Structured judgment
- Hard caps (percentage complete)
- Transparent modifier breakdown
- Configurable algorithm values via external config file

---

## Core Philosophy
This is a decision-support tool — not a physics engine.
It disciplines intuition using structured inputs and weighted modifiers.

---

## V2 Inputs

### 1. Environment
- Rural
- Backcountry
- Urban (placeholder workflow for future)

### 2. Search Objective (Mutually Exclusive)
A) Person Search
- Adult
- Child

B) Evidence / Historical
- Recently deceased remains
- Skeletal remains
- Burial site
- Large evidence
- Small evidence

### 3. Ground & Conditions
- Vegetation density (Low / Medium / High)
- Terrain difficulty (Easy / Moderate / Difficult)
- Lighting (Day / Dusk-Dawn / Night)

### 4. Line Search Parameters
- Spacing between searchers (meters)
- % Segment Completed (hard cap)

### 5. Detectability Rating (1–5)
Anchored scale with tooltips.

---

## Output Structure

Per segment:
- POD (Completed Portion)
- POD (Whole Segment – capped by % Complete)
- Breakdown of modifiers used
- Never display 100%

---

## Proposed Mathematical Structure (Config-Driven)

EffectiveDetection =
    BaseRate(target_type)
    × SpacingModifier(spacing)
    × VegetationModifier
    × TerrainModifier
    × LightingModifier
    × DetectabilityModifier

POD_completed =
    1 - exp(-EffectiveDetection)

POD_whole =
    POD_completed × (%Complete / 100)

Final cap: never exceed MaxPODCap (config value)

---

## Architecture Notes

- All multipliers stored in config.json
- App loads config.json at runtime
- Allows tuning without touching core logic
- Versioned algorithm config printed in report

---

## Build Phases

Phase 1 – UI & Workflow
Phase 2 – Config-driven math engine
Phase 3 – Transparency panel (show applied multipliers)
Phase 4 – Report generation
Phase 5 – Offline PWA implementation
Phase 6 – Calibration with experienced members

---

## Future Expansion

- Urban workflow branch
- Cumulative POD across searches
- Auto-sync to Incident Command portal
- Calibration presets
