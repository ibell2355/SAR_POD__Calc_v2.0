export function toExportJson(data) {
  return JSON.stringify(data, null, 2);
}

export function parseImportJson(text) {
  return JSON.parse(text);
}

export function toSegmentCsv(profile) {
  const headers = [
    'profile_id', 'profile_name', 'segment_id', 'segment_start', 'segment_end',
    'time_of_day', 'weather', 'detectability_level', 'critical_spacing_m',
    'area_coverage_pct', 'target', 'pod_final'
  ];
  const rows = [headers.join(',')];
  for (const mission of profile.missions || []) {
    for (const segment of mission.segments || []) {
      for (const result of segment.results || []) {
        rows.push([
          profile.id,
          quote(profile.name),
          segment.id,
          segment.segment_start_time,
          segment.segment_end_time,
          segment.time_of_day,
          segment.weather,
          segment.detectability_level,
          segment.critical_spacing_m,
          segment.area_coverage_pct,
          result.target,
          result.POD_final.toFixed(4)
        ].join(','));
      }
    }
  }
  return rows.join('\n');
}

function quote(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
