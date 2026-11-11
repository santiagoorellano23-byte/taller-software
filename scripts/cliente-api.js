// Cliente HTTP mínimo para cargar datos de prueba y para las pruebas automáticas.
// Usa la API real, así los datos pasan por las mismas reglas y permisos que en el uso diario.
import crypto from 'node:crypto';
import {fotosPrueba} from './fotos-prueba.js';

export class ClienteApi {
  constructor(base) { this.base = base; this.cookie = ''; }
  async pedir(metodo, ruta, cuerpo, { idempotencia, cabeceras = {}, crudo } = {}) {
    const h = { 'X-Talleres': '1', ...cabeceras };
    if (this.cookie) h.Cookie = this.cookie;
    if (idempotencia) h['Idempotency-Key'] = idempotencia === true ? crypto.randomUUID() : idempotencia;
    let body;
    if (crudo) body = crudo;
    else if (cuerpo !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(cuerpo); }
    const res = await fetch(this.base + ruta, { method: metodo, headers: h, body });
    const sc = res.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const tipo = res.headers.get('content-type') || '';
    const datos = tipo.includes('application/json') ? await res.json() : await res.text();
    return { estado: res.status, datos, res };
  }
  async ok(metodo, ruta, cuerpo, op) {
    const r = await this.pedir(metodo, ruta, cuerpo, op);
    if (r.estado >= 400) throw new Error(`${metodo} ${ruta} → ${r.estado}: ${typeof r.datos === 'string' ? r.datos.slice(0, 200) : r.datos.error}`);
    return r.datos;
  }
  get(r) { return this.ok('GET', r); }
  post(r, c, op) { return this.ok('POST', r, c, op); }
  async recibir(c,op) { c.estadoIngreso ||= await fotosPrueba(this); return this.post('/api/visitas',c,op); }
  put(r, c, op) { return this.ok('PUT', r, c, op); }
  async ingresar(email, clave) { return this.ok('POST', '/api/sesion/ingresar', { email, clave }); }
}
