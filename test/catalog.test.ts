import { describe, expect, it } from 'vitest';
import { loadCapabilityCatalog, loadSkillCatalog, validateCatalogBundle } from '../src/catalog.js';

const LITE_SKILLS = ['codebase-research', 'grill-me', 'ralplan', 'team', 'ralph', 'ultrawork', 'ultraqa', 'autopilot', 'code-review', 'verify', 'jira-ticket', 'prototype', 'caveman', 'debug', 'tdd'];

describe('general skill catalog', () => {
  it('contains the approved lite Copilot project skills', () => {
    const catalog = loadSkillCatalog();
    const validation = validateCatalogBundle();

    expect(validation.issues).toEqual([]);
    expect(catalog.commandPrefix).toBe('/');
    expect(catalog.skills.map((skill) => skill.name)).toEqual(LITE_SKILLS);

    const commands = new Set(catalog.skills.flatMap((skill) => skill.slashCommands));
    expect([...commands]).toEqual(expect.arrayContaining(LITE_SKILLS));
  });

  it('marks every Copilot compatibility state as supported, fallback, or unsupported', () => {
    const capabilities = loadCapabilityCatalog();
    for (const capability of capabilities.capabilities) {
      expect(capability.providers, capability.id).toBeTruthy();
      for (const state of Object.values(capability.providers ?? {})) {
        expect(['supported', 'fallback', 'unsupported'], `${capability.id}:${state}`).toContain(state);
      }
    }
  });

  it('keeps all Phase 1 capability surfaces native project skills', () => {
    const capabilities = loadCapabilityCatalog();
    for (const id of LITE_SKILLS) {
      const capability = capabilities.capabilities.find((entry) => entry.id === id);
      expect(capability, `${id} capability exists`).toBeTruthy();
      expect(capability?.providerSupport.copilot.state).toBe('native');
      expect(capability?.providerSupport.copilot.notes).toContain(`/${id}`);
    }
  });
});
