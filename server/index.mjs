// Servidor local: sirve la app y hace de puente con Jev para que la API key
// de TypeSafe nunca llegue al navegador.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TypeSafeClient, APIError, APIConnectionError } from '@typesafe-ai/sdk';
import { buildRequest, parseAnswers } from './jev.mjs';

const ROOT = fileURLToPath(new URL('../app/', import.meta.url));
const PORT = +process.env.PORT || 8000;
// Interruptor: JEV_ENABLED=0 apaga las consultas aunque haya key.
const JEV_ON = process.env.JEV_ENABLED !== '0' && !!process.env.TYPESAFE_API_KEY?.trim();
const client = JEV_ON ? new TypeSafeClient({ timeout: 30000 }) : null;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readJson(req, limit = 200_000) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new Error('Petición demasiado grande.'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleJev(req, res) {
  if (!client) return send(res, 503, { error: 'Jev está apagado. Define TYPESAFE_API_KEY en el entorno y reinicia el servidor.' });
  let body, request;
  try {
    body = await readJson(req);
    request = buildRequest(body.table, body.fixtures);
  } catch (e) {
    return send(res, 400, { error: e.message });
  }
  try {
    const result = await client.systemOne(request);
    send(res, 200, { model: result.model, usage: result.usage, forecasts: parseAnswers(body.fixtures, result.answers) });
  } catch (e) {
    if (e instanceof APIError) {
      const msg = e.status === 401 ? 'TypeSafe rechazó la API key.' : e.status === 429 ? 'TypeSafe pidió esperar un momento (límite de uso).' : `TypeSafe respondió ${e.status}.`;
      console.error('Jev error', e.status, e.requestId);
      return send(res, 502, { error: msg });
    }
    if (e instanceof APIConnectionError) return send(res, 504, { error: 'No hubo conexión con TypeSafe. Revisa la red e intenta de nuevo.' });
    console.error(e);
    send(res, 500, { error: 'Error inesperado consultando a Jev.' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/status') return send(res, 200, { jev: JEV_ON });
  if (url.pathname === '/api/jev' && req.method === 'POST') return handleJev(req, res);
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido.' });
  const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)).replace(/^([/\\])+/, '');
  if (rel.startsWith('..')) return send(res, 403, 'Prohibido', 'text/plain');
  try {
    let data = await readFile(join(ROOT, rel));
    if (rel === 'index.html') data = Buffer.concat([Buffer.from('<!doctype html>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'), data]);
    send(res, 200, data, TYPES[extname(rel)] ?? 'application/octet-stream');
  } catch {
    send(res, 404, 'No encontrado', 'text/plain');
  }
});

server.listen(PORT, () => {
  console.log(`App en http://localhost:${PORT}  ·  Jev ${JEV_ON ? 'activo' : 'apagado (falta TYPESAFE_API_KEY o JEV_ENABLED=0)'}`);
});
