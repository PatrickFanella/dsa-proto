import { describe, expect, it } from 'vitest';
import { compatibilityIssues } from './lexicon-compatibility.js';

describe('Lexicon compatibility gate', () => {
  const baseline = { lexicon: 1, id: 'com.example.record', defs: { main: { type: 'record', key: 'tid', record: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } } };

  it('allows optional fields', () => {
    const current = structuredClone(baseline);
    (current.defs.main.record.properties as Record<string, unknown>).description = { type: 'string' };
    expect(compatibilityIssues(baseline, current)).toEqual([]);
  });

  it('rejects removed, renamed, newly required, or retyped fields', () => {
    const current = structuredClone(baseline);
    current.defs.main.record.required.push('description');
    current.defs.main.record.properties.name.type = 'integer';
    const issues = compatibilityIssues(baseline, current).join(' ');
    expect(issues).toContain('required changed');
    expect(issues).toContain('type changed');
  });
});
