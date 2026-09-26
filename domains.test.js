import { test, expect } from 'bun:test';
import { parseArgs, expandDomains, checkDomains } from './domains.js';

test('combina nombres y extensiones compuestas, normaliza y elimina duplicados', () => {
  expect(expandDomains(['Cafe', 'cafe'], ['com', 'com.mx'])).toEqual(['cafe.com', 'cafe.com.mx']);
  expect(expandDomains(['café.com'], [])).toEqual(['xn--caf-dma.com']);
});

test('rechaza dominios, opciones y límites inválidos antes de consultar', () => {
  for (const name of ['https://example.com', '-bad.com', 'a..com', 'solo']) expect(() => expandDomains([name], [])).toThrow();
  for (const args of [['register', '--admin'], ['search', 'cafe', '--limit', '0'], ['check', 'cafe', '--tlds'], ['check', 'cafe', '--tlds', 'com,']]) expect(() => parseArgs(args)).toThrow();
});

test('divide más de 20 dominios en lotes y conserva todos los resultados', async () => {
  const domains = Array.from({ length: 45 }, (_, i) => `probe${i}.com`);
  const sizes = [];
  const result = await checkDomains(domains, async (endpoint, data) => {
    expect(endpoint).toBe('domain-check');
    sizes.push(data.domains.length);
    return data.domains.map(name => ({ name }));
  });
  expect(sizes).toEqual([20, 20, 5]);
  expect(result.map(d => d.name)).toEqual(domains);
});
