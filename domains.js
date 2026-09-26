#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { domainToASCII } from 'node:url';

const help = `Consulta dominios y precios con Cloudflare (sin compras).

  bun run domains check nombre.com otro.dev
  bun run domains check nombre otro --tlds com,mx,dev
  bun run domains search "cafeteria" --limit 10

Opciones:
  --tlds, -t com,mx,dev   Combina cada nombre con estas extensiones en check.
  --available            Muestra solo dominios registrables en Cloudflare.
  --json                 Salida JSON para scripts.
  --limit N              Sugerencias por búsqueda (1–50, por defecto 20).
  --help, -h             Esta ayuda.

También puedes omitir check: bun run domains nombre --tlds com,dev
Los precios se muestran en la moneda de Cloudflare; no se convierten a MXN.
search devuelve sugerencias de caché; confirma con check.
`;

export function parseArgs(args) {
  const options = { command: 'check', names: [], tlds: [], json: false, available: false, limit: 20 };
  if (['check', 'search'].includes(args[0])) options.command = args.shift();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--json') options.json = true;
    else if (arg === '--available') options.available = true;
    else if (['--tlds', '-t', '--limit'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('-')) throw new Error(`Falta el valor de ${arg}.`);
      if (arg === '--limit') {
        options.limit = Number(value);
        if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 50) throw new Error('El límite debe ser un entero entre 1 y 50.');
      } else options.tlds.push(...value.split(',').map(t => t.trim().replace(/^\./, '').toLowerCase()));
    } else if (arg.startsWith('-')) throw new Error(`Opción desconocida: ${arg}. Usa --help.`);
    else options.names.push(arg);
  }
  if (!options.names.length) throw new Error('Escribe al menos un nombre o dominio. Usa --help.');
  if (options.command === 'search' && options.tlds.length) throw new Error('Usa check con --tlds para combinar nombres y extensiones exactas.');
  for (const tld of options.tlds) if (!/^[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(tld)) throw new Error('Hay una extensión inválida en --tlds.');
  return options;
}

export function expandDomains(names, tlds) {
  const domains = names.flatMap(name => tlds.length ? tlds.map(tld => `${name}.${tld}`) : [name]);
  return [...new Set(domains.map(input => {
    const domain = domainToASCII(input.trim().toLowerCase());
    if (!domain || domain.length > 253 || domain.split('.').length < 2 || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error(`Dominio inválido: ${input}. Usa dominios completos o nombres con --tlds.`);
    return domain;
  }))];
}

export async function checkDomains(domains, request) {
  const batches = [];
  for (let i = 0; i < domains.length; i += 20) batches.push(domains.slice(i, i + 20));
  const results = new Array(batches.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, batches.length) }, async () => {
    while (next < batches.length) {
      const index = next++;
      results[index] = await request('domain-check', { domains: batches[index] });
    }
  }));
  return results.flat();
}

function credentials() {
  let local = {};
  try { local = parseEnv(readFileSync(new URL('.env', import.meta.url), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('No pude leer el .env del proyecto.'); }
  const account = process.env.ACCOUNT_ID || local.ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || local.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new Error('Faltan credenciales. Ejecuta bash setup-env.sh en la carpeta del proyecto.');
  if (!/^[a-f0-9]{32}$/i.test(account)) throw new Error('El Account ID debe tener 32 caracteres hexadecimales.');
  return { account, token };
}

function api({ account, token }) {
  return async (endpoint, data) => {
    // Lista cerrada: este cliente no puede enviar operaciones de registro.
    if (endpoint !== 'domain-check' && !endpoint.startsWith('domain-search?')) throw new Error('Operación no permitida.');
    let response;
    try {
      response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/registrar/${endpoint}`, {
        method: data ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(30000),
      });
    } catch { throw new Error('No pude conectar con Cloudflare. Revisa tu conexión e intenta de nuevo.'); }
    if (response.status === 401 || response.status === 403) throw new Error('Cloudflare rechazó el acceso. Revisa el token, su cuenta y el permiso Registrar Domains → Read.');
    if (response.status === 429) throw new Error('Cloudflare limitó las consultas. Espera un momento e intenta de nuevo.');
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Cloudflare devolvió una respuesta inesperada. Intenta de nuevo.'); }
    if (!response.ok || !payload.success) throw new Error('Cloudflare no pudo completar la consulta. Revisa la configuración de Registrar en tu cuenta e intenta de nuevo.');
    if (!Array.isArray(payload.result?.domains)) throw new Error('Cloudflare devolvió resultados inesperados.');
    return payload.result.domains;
  };
}

const reasons = {
  domain_unavailable: 'Ocupado / no disponible',
  extension_not_supported_via_api: 'Extensión fuera de la API',
  extension_not_supported: 'Cloudflare no ofrece esta extensión',
  extension_disallows_registration: 'Registro suspendido por la extensión',
};
function display(domains, options) {
  const rows = options.available ? domains.filter(d => d.registrable) : domains;
  if (options.json) { console.log(JSON.stringify(rows, null, 2)); return; }
  if (!rows.length) { console.log('No hay resultados con estos filtros.'); return; }
  console.table(rows.map(d => ({
    Dominio: d.name,
    Estado: d.registrable ? 'Disponible en Cloudflare' : reasons[d.reason] || 'No registrable',
    Registro: d.pricing ? `${d.pricing.registration_cost} ${d.pricing.currency}` : '—',
    Renovación: d.pricing ? `${d.pricing.renewal_cost} ${d.pricing.currency}` : '—',
    Tipo: d.tier || '—',
  })));
  if (options.command === 'search') console.log('Sugerencias de caché. Confirma disponibilidad y precios con check.');
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (!args.length) { console.log(help); process.exit(0); }
    const options = parseArgs(args);
    if (options.help) { console.log(help); process.exit(0); }
    const domains = options.command === 'check' ? expandDomains(options.names, options.tlds) : null;
    const request = api(credentials());
    let results;
    if (domains) results = await checkDomains(domains, request);
    else {
      results = [];
      for (const name of options.names) results.push(...await request(`domain-search?${new URLSearchParams({ q: name, limit: String(options.limit) })}`));
      results = [...new Map(results.map(d => [d.name, d])).values()];
    }
    display(results, options);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
