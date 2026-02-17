import { emergencyDefaults } from '../../config/defaults.js';
import { validateAgainstSchema } from './configValidator.js';
import { parseSimpleYaml } from '../utils/simpleYaml.js';

const CONFIG_CANDIDATES = [
  '/config/SAR_POD_V2_config.yaml',
  './config/SAR_POD_V2_config.yaml',
  '/config/SAR_POD_V2_algorithm_config.json',
  './config/SAR_POD_V2_algorithm_config.json'
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
    const schemaRes = await fetch('./config/config.schema.json');
    if (!schemaRes.ok) {
      throw new Error(`Schema fetch failed (${schemaRes.status})`);
    }
    const schema = await schemaRes.json();

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

    const errors = validateAgainstSchema(config, schema);
    if (errors.length) {
      return {
        config: emergencyDefaults,
        diagnostics: errors.map((e) => `• ${e}`).join('\n'),
        valid: false,
        path: selectedPath,
        errors: errors.map((error) => buildError('CONFIG_VALIDATION_ERROR', selectedPath, error))
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
