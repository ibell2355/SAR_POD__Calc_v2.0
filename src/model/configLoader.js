import { parseSimpleYaml } from '../utils/simpleYaml.js';

const CONFIG_CANDIDATES = [
  '/config/SAR_POD_V2_config.yaml',
  './config/SAR_POD_V2_config.yaml'
];

function parseConfig(raw, path) {
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return parseSimpleYaml(raw);
  if (path.endsWith('.json')) return JSON.parse(raw);
  throw new Error(`Unsupported config extension for ${path}`);
}

function buildError(code, path, message, cause = null) {
  return { code, path, message, cause };
}

export async function loadConfig() {
  const structuredErrors = [];
  let selectedPath = CONFIG_CANDIDATES[0];

  try {
    let config;
    let loaded = false;
    for (const path of CONFIG_CANDIDATES) {
      selectedPath = path;
      const response = await fetch(path);
      if (!response.ok) {
        structuredErrors.push(buildError('CONFIG_NOT_FOUND', path, `Config not found (${response.status})`));
        continue;
      }
      try {
        config = parseConfig(await response.text(), path);
        loaded = true;
        break;
      } catch (error) {
        structuredErrors.push(buildError('CONFIG_PARSE_ERROR', path, `Unable to parse config`, error.message));
      }
    }

    if (!loaded) {
      const detail = structuredErrors.map((e) => `${e.code}: ${e.message}${e.cause ? ' — ' + e.cause : ''}`).join('; ');
      console.error('[configLoader] All config candidates failed:', structuredErrors);
      return {
        config: null,
        diagnostics: `No readable config found. (${detail})`,
        valid: false,
        path: selectedPath,
        errors: structuredErrors
      };
    }

    // Basic sanity check: ensure required top-level keys exist
    const required = ['targets', 'condition_factors', 'response_model'];
    const missing = required.filter((k) => !config[k]);
    // Accept either new spacing_bounds_m or legacy reference_spacing_bounds_m
    if (!config.spacing_bounds_m && !config.reference_spacing_bounds_m) {
      missing.push('spacing_bounds_m');
    }
    if (missing.length) {
      return {
        config: null,
        diagnostics: `Config missing required keys: ${missing.join(', ')}`,
        valid: false,
        path: selectedPath,
        errors: missing.map((k) => buildError('CONFIG_VALIDATION_ERROR', selectedPath, `Missing required key: ${k}`))
      };
    }

    return { config, diagnostics: '', valid: true, path: selectedPath, errors: [] };
  } catch (error) {
    return {
      config: null,
      diagnostics: `Unable to load config: ${error.message}`,
      valid: false,
      path: selectedPath,
      errors: [...structuredErrors, buildError('CONFIG_LOAD_FAILURE', selectedPath, 'Unable to load config', error.message)]
    };
  }
}
