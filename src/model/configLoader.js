import { emergencyDefaults } from '../../config/defaults.js';
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
      return {
        config: emergencyDefaults,
        diagnostics: 'No readable config found. Using emergency defaults.',
        valid: false,
        path: selectedPath,
        errors: structuredErrors
      };
    }

    // Basic sanity check: ensure required top-level keys exist
    const required = ['targets', 'condition_factors', 'reference_spacing_bounds_m', 'response_model'];
    const missing = required.filter((k) => !config[k]);
    if (missing.length) {
      return {
        config: emergencyDefaults,
        diagnostics: `Config missing required keys: ${missing.join(', ')}`,
        valid: false,
        path: selectedPath,
        errors: missing.map((k) => buildError('CONFIG_VALIDATION_ERROR', selectedPath, `Missing required key: ${k}`))
      };
    }

    return { config, diagnostics: '', valid: true, path: selectedPath, errors: [] };
  } catch (error) {
    return {
      config: emergencyDefaults,
      diagnostics: `Unable to load config: ${error.message}`,
      valid: false,
      path: selectedPath,
      errors: [...structuredErrors, buildError('CONFIG_LOAD_FAILURE', selectedPath, 'Unable to load config', error.message)]
    };
  }
}
