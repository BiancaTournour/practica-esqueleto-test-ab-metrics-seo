# Laboratorio 01 · Taller Norte — una landing, dos mensajes, una sola URL indexable

Experimento A/B sobre `/practica` sin páginas duplicadas. Next.js 16 (App Router + `proxy.ts`).

## Cómo correrlo

```bash
pnpm install
pnpm dev            # http://localhost:3000/practica  y  /bitacora
```

Sin variables de entorno, el log de eventos se guarda en `.data/lab01-log.json` (solo desarrollo).
Para la entrega, conectar una base Redis por REST (Upstash, o Vercel KV desde el Marketplace) y cargar
las variables de `.env.example` en el panel del hosting. **No subir valores reales al repositorio.**

## Dónde está cada cosa

| Archivo | Qué hace |
| --- | --- |
| `proxy.ts` | Primer request sin cookie: crea el visitante y asigna la variante. `?preview=` no toca cookies ni cuenta. Crawlers: control fijo. Anota una impresión por sesión de 30 min. |
| `lib/experiment.ts` | Copy, oferta, caso fijo, **hash estable**, tasa, `parseLog` (validación). |
| `lib/store.ts` | Log de eventos en una base (Redis REST; archivo local en dev). Deduplica en el servidor. |
| `app/practica/page.tsx` | Title, description, canonical y robots, generados en el servidor. |
| `app/practica/actions.ts` | Server Action del CTA: una conversión por visitante. |
| `app/bitacora/page.tsx` | Caso fijo (7,50 % · 13,14 % · 5,64 pp), log real y prueba del hash. |
| `components/` | Mensaje y botón (el botón no cuenta en preview). |

## Decisiones

**Función de hash.** FNV-1a de 32 bits + finalizador `fmix32` de MurmurHash3, sobre `"taller-norte-lab01:" + visitorId`;
par → A, impar → B. Pura, sin `Math.random()` ni estado. `assignVariant('lab-visitor-demo-01')` → **A**
(hash32 = 791431488), idéntico en cualquier repetición. Reparto medido: 50,1 % / 49,9 % con 100 000 UUID.

**Cookies** (todas `httpOnly`, `path=/`): `lab_visitor` y `lab_variant` (30 días), `lab_impressed` (30 min),
`lab_converted` (30 días). `Secure` + `SameSite=None` + `Partitioned` cuando el request es HTTPS (vista previa
embebida); `SameSite=Lax` en `http://localhost`. La variante **se recalcula** del hash en cada uso: una cookie
`lab_variant` alterada no sirve para nada.

**Eventos.** La cookie solo guarda visitante y variante. Los conteos viven en la base. La deduplicación la decide
el servidor con `SET … NX EX` (`claimOnce`): una impresión por visitante cada 1800 s, una conversión por visitante
cada 30 días, aunque el cliente borre cookies sueltas. Prefetch, HEAD, POST y crawlers no cuentan.

**SEO.** Title y description salen del servidor (`generateMetadata`), con `title.absolute` para evitar el sufijo
del layout. Canonical único: `/practica`. `?preview=` lleva `noindex` en `<meta robots>` y en `X-Robots-Tag`.
La respuesta se marca `Cache-Control: private, no-store` + `Vary: Cookie, User-Agent` para que ningún CDN
sirva la variante de una persona a otra.

**Crawlers.** Reciben siempre el control (A) en la misma URL y con el mismo canonical, sin cookies y sin contar.
No es cloaking: no se muestra otro contenido para manipular el ranking; se fija el mensaje que ya ve la mitad de
las personas, para que el buscador no indexe un texto inestable.
