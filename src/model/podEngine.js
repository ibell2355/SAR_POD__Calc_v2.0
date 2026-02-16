import { clamp } from '../utils/math.js';

/**
 * UI Label -> code key mapping table
 * - "Critical spacing (meters)" -> critical_spacing_m
 * - "Area coverage (%)" -> area_coverage_pct
 */
export function inferPrimaryTarget(selectedTargets, config) {
  const order = config?.pod?.target_hierarchy || [];
  return order.find((target) => selectedTargets.includes(target)) || selectedTargets[0] || null;
}

export function responseMultiplier(searchLevel, config) {
  if (searchLevel.type_of_search !== 'active_missing_person') return 1;
  const aud = config.active_responsiveness.auditory[searchLevel.auditory || 'none'] || 0;
  const vis = config.active_responsiveness.visual[searchLevel.visual || 'none'] || 0;
  return Math.min(config.active_responsiveness.cap, 1 + aud + vis);
}

export function spacingEffectiveness(S_ref, S_act, k) {
  if (!S_act || S_act <= 0) return 0;
  return Math.min(1, (S_ref / S_act) ** k);
}

export function completionMultiplier(segment) {
  return clamp((Number(segment.area_coverage_pct) || 0) / 100, 0, 1);
}

export function computeForTarget({ config, searchLevel, segment, targetKey }) {
  const target = config.targets[targetKey] || {};
  const S_base = target.S_base || config.pod.S_base;
  const F_time = config.factors.time_of_day[segment.time_of_day] ?? 1;
  const F_weather = config.factors.weather[segment.weather] ?? 1;
  const F_detectability = config.factors.detectability[String(segment.detectability_level)] ?? 1;

  const C_t = F_time * F_weather * F_detectability;
  const S_ref_raw = S_base * C_t;
  const S_ref = clamp(S_ref_raw, config.pod.min_ref, config.pod.max_ref);
  const E_space = spacingEffectiveness(S_ref, Number(segment.critical_spacing_m), config.pod.k);
  const M_resp = responseMultiplier(searchLevel, config);
  const M_comp = completionMultiplier(segment);

  const POD_pre = config.pod.POD_ceiling * E_space * M_resp;
  const POD_final = clamp(POD_pre * M_comp, 0, 0.99);

  return {
    target: targetKey,
    C_t,
    S_ref_raw,
    S_ref,
    E_space,
    M_resp,
    M_comp,
    POD_pre,
    POD_final
  };
}

export function selectedTargets(searchLevel) {
  if (searchLevel.type_of_search === 'active_missing_person') {
    return searchLevel.active_targets || [];
  }
  const targets = [];
  if (searchLevel.remains_state) targets.push(searchLevel.remains_state);
  return targets.concat(searchLevel.evidence_classes || []);
}
