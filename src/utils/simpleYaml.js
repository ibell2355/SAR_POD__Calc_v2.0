function toScalar(raw) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseSimpleYaml(text) {
  const root = {};
  const stack = [{ indent: -1, container: root }];
  const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const indent = line.match(/^\s*/)[0].length;
    const trimmed = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].container;

    if (trimmed.startsWith('- ')) {
      if (!Array.isArray(parent)) throw new Error(`Invalid array placement for line: ${line}`);
      parent.push(toScalar(trimmed.slice(2)));
      continue;
    }

    const idx = trimmed.indexOf(':');
    if (idx < 0) throw new Error(`Invalid YAML line: ${line}`);
    const key = trimmed.slice(0, idx).trim();
    const rest = trimmed.slice(idx + 1).trim();

    if (rest) {
      parent[key] = toScalar(rest);
      continue;
    }

    const nextLine = lines[i + 1] || '';
    const isArray = nextLine.trim().startsWith('- ');
    parent[key] = isArray ? [] : {};
    stack.push({ indent, container: parent[key] });
  }

  return root;
}
