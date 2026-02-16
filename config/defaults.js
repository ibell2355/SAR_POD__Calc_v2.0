export const emergencyDefaults = {
  pod: {
    S_base: 20,
    min_ref: 2,
    max_ref: 120,
    k: 1.3,
    POD_ceiling: 0.95,
    target_hierarchy: ['adult', 'child']
  },
  factors: {
    time_of_day: { day: 1, dusk_dawn: 0.75, night: 0.5 },
    weather: { clear: 1, rain: 0.8, snow: 0.6 },
    detectability: { '1': 0.5, '2': 0.65, '3': 0.8, '4': 0.92, '5': 1 }
  },
  active_responsiveness: {
    cap: 1.3,
    auditory: { none: 0, possible: 0.07, likely: 0.13 },
    visual: { none: 0, possible: 0.08, likely: 0.15 }
  },
  targets: {
    adult: { S_base: 28 },
    child: { S_base: 19 }
  }
};
