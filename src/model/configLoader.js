import { emergencyDefaults } from '../../config/defaults.js';
import { validateAgainstSchema } from './configValidator.js';
import { parseSimpleYaml } from '../utils/simpleYaml.js';

export async function loadConfig() {
  try {
    const [yamlRes, schemaRes] = await Promise.all([
      fetch('./config/SAR_POD_V2_config.yaml'),
      fetch('./config/config.schema.json')
    ]);
    const config = parseSimpleYaml(await yamlRes.text());
    const schema = await schemaRes.json();
    const errors = validateAgainstSchema(config, schema);
    if (errors.length) {
      return { config: emergencyDefaults, diagnostics: errors.map((e) => `• ${e}`).join('\n'), valid: false };
    }
    return { config, diagnostics: '', valid: true };
  } catch (error) {
    return { config: emergencyDefaults, diagnostics: `Unable to load config: ${error.message}`, valid: false };
  }
}
