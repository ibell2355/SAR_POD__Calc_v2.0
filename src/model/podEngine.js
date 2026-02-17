import { clamp } from '../utils/math.js';

const POD_DEFAULTS = {
  POD_ceiling: 0.85,
  S_base: 15,
  k: 1.6,
  min_ref: 1,
  max_ref: 200
};

const FACTOR_DEFAULTS = {
  time_of_day: { day: 1, dusk_dawn: 1, night: 1 },
  weather: { clear: 1, rain: 1, snow: 1 },
  detectability: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }
};

function safePod(config) {
  return { ...POD_DEFAULTS, ...(config?.pod || {}) };
}

function safeFactors(config) {
  const factors = config?.factors || {};
  return {
    time_of_day: { ...FACTOR_DEFAULTS.time_of_day, ...(factors.time_of_day || {}) },
    weather: { ...FACTOR_DEFAULTS.weather, ...(factors.weather || {}) },
    detectability: { ...FACTOR_DEFAULTS.detectability, ...(factors.detectability || {}) }
  };
}

function safeResponsiveness(config) {
  const r = config?.active_responsiveness || {};
  return {
    auditory: { none: 0, possible: 0, likely: 0, ...(r.auditory || {}) },
    visual: { none: 0, possible: 0, likely: 0, ...(r.visual || {}) },
    cap: Number(r.cap ?? 1.3)
  };
}

export function inferPrimaryTarget(selectedTargets, config) {
  const order = config?.pod?.target_hierarchy || [];
  return order.find((target) => selectedTargets.includes(target)) || selectedTargets[0] || null;
}

export function responseMultiplier(searchLevel, config) {
  if (searchLevel.type_of_search !== 'active_missing_person') return 1;
  const responsive = safeResponsiveness(config);
  const aud = responsive.auditory[searchLevel.auditory || 'none'] || 0;
  const vis = responsive.visual[searchLevel.visual || 'none'] || 0;
  return Math.min(responsive.cap, 1 + aud + vis);
}

export function responseComponents(searchLevel, config) {
  const responsive = safeResponsiveness(config);
  if (searchLevel.type_of_search !== 'active_missing_person') {
    return { auditory_bonus: 0, visual_bonus: 0, cap: responsive.cap, M_resp: 1 };
  }
  const auditory_bonus = responsive.auditory[searchLevel.auditory || 'none'] || 0;
  const visual_bonus = responsive.visual[searchLevel.visual || 'none'] || 0;
  const cap = responsive.cap;
  return { auditory_bonus, visual_bonus, cap, M_resp: Math.min(cap, 1 + auditory_bonus + visual_bonus) };
}

export function spacingEffectiveness(S_ref, S_act, k) {
  if (!S_act || S_act <= 0) return 0;
  return Math.min(1, (S_ref / S_act) ** k);
}

export function completionMultiplier(segment) {
  return clamp((Number(segment?.area_coverage_pct) || 0) / 100, 0, 1);
}

export function computeForTarget({ config, searchLevel, segment, targetKey }) {
  const pod = safePod(config);
  const factors = safeFactors(config);
  const targets = config?.targets || {};
  const target = targets[targetKey] || {};

  const S_base = Number(target.S_base ?? pod.S_base);
  const F_time = Number(factors.time_of_day[segment?.time_of_day] ?? 1);
  const F_weather = Number(factors.weather[segment?.weather] ?? 1);
  const F_detectability = Number(factors.detectability[String(segment?.detectability_level ?? 3)] ?? 1);

  const C_t = F_time * F_weather * F_detectability;
  const S_ref_raw = S_base * C_t;
  const S_ref = clamp(S_ref_raw, Number(pod.min_ref), Number(pod.max_ref));
  const E_space = spacingEffectiveness(S_ref, Number(segment?.critical_spacing_m), Number(pod.k));
  const response = responseComponents(searchLevel || {}, config);
  const M_resp = response.M_resp;
  const M_comp = completionMultiplier(segment || {});

  const POD_pre = Number(pod.POD_ceiling) * E_space * M_resp;
  const POD_final = clamp(POD_pre * M_comp, 0, 0.99);

  return {
    target: targetKey,
    POD_ceiling: Number(pod.POD_ceiling),
    S_base,
    k: Number(pod.k),
    min_ref: Number(pod.min_ref),
    max_ref: Number(pod.max_ref),
    F_time,
    F_weather,
    F_detectability,
    C_t,
    S_ref_raw,
    S_ref,
    E_space,
    M_resp,
    M_comp,
    POD_pre,
    POD_final,
    auditory_bonus: response.auditory_bonus,
    visual_bonus: response.visual_bonus,
    response_cap: response.cap
  };
}

export function selectedTargets(searchLevel) {
  if (searchLevel.type_of_search === 'active_missing_person') {
    return searchLevel.active_targets || [];
  }
  const targets = [];
  const cats = searchLevel.evidence_categories || ['remains'];
  if (cats.includes('remains') && searchLevel.remains_state) {
    targets.push(searchLevel.remains_state);
  }
  if (cats.includes('evidence')) {
    targets.push(...(searchLevel.evidence_classes || []));
  }
  return targets;
}
