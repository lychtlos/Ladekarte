/* ============================================================
   Ladekarte — Server
   Node >= 22, ohne externe Abhängigkeiten.
   Liefert die App aus /public und hält die Ladekarten je Konto.
   ============================================================ */
import http from "node:http";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const scryptAsync = promisify(scrypt);
const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const OEFFENTLICH = path.join(WURZEL, "docs");

const PORT = Number(process.env.PORT || 8080);
const DB_PFAD = process.env.DB_PATH || path.join(WURZEL, "data", "ladekarte.db");
const SICHERE_COOKIES = process.env.SECURE_COOKIES === "1";
const SESSION_TAGE = 400;

/* ---------- Datenbank ---------------------------------------------------- */
fs.mkdirSync(path.dirname(DB_PFAD), { recursive: true });
const db = new DatabaseSync(DB_PFAD);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS nutzer (
    id         INTEGER PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    passwort   TEXT NOT NULL,
    erstellt   TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sitzung (
    token_hash TEXT PRIMARY KEY,
    nutzer_id  INTEGER NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE,
    laeuft_ab  INTEGER NOT NULL,
    erstellt   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sitzung_nutzer ON sitzung(nutzer_id);
  CREATE TABLE IF NOT EXISTS karten (
    nutzer_id  INTEGER PRIMARY KEY REFERENCES nutzer(id) ON DELETE CASCADE,
    daten      TEXT NOT NULL,
    rev        INTEGER NOT NULL,
    geaendert  TEXT NOT NULL
  );
`);

const q = {
  nutzerPerEmail: db.prepare("SELECT * FROM nutzer WHERE email = ?"),
  nutzerPerId: db.prepare("SELECT * FROM nutzer WHERE id = ?"),
  nutzerAnlegen: db.prepare("INSERT INTO nutzer (email, passwort, erstellt) VALUES (?, ?, ?)"),
  nutzerLoeschen: db.prepare("DELETE FROM nutzer WHERE id = ?"),
  passwortSetzen: db.prepare("UPDATE nutzer SET passwort = ? WHERE id = ?"),
  sitzungAnlegen: db.prepare("INSERT INTO sitzung (token_hash, nutzer_id, laeuft_ab, erstellt) VALUES (?, ?, ?, ?)"),
  sitzungLesen: db.prepare("SELECT * FROM sitzung WHERE token_hash = ?"),
  sitzungLoeschen: db.prepare("DELETE FROM sitzung WHERE token_hash = ?"),
  sitzungenLoeschen: db.prepare("DELETE FROM sitzung WHERE nutzer_id = ? AND token_hash <> ?"),
  sitzungenAufraeumen: db.prepare("DELETE FROM sitzung WHERE laeuft_ab < ?"),
  kartenLesen: db.prepare("SELECT * FROM karten WHERE nutzer_id = ?"),
  kartenSchreiben: db.prepare(`INSERT INTO karten (nutzer_id, daten, rev, geaendert) VALUES (?, ?, ?, ?)
                               ON CONFLICT(nutzer_id) DO UPDATE SET daten = excluded.daten,
                                 rev = excluded.rev, geaendert = excluded.geaendert`)
};

setInterval(() => {
  try { q.sitzungenAufraeumen.run(Date.now()); } catch { /* egal */ }
}, 6 * 60 * 60 * 1000).unref();

/* ---------- Passwörter --------------------------------------------------- */
const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };

async function passwortHash(klartext) {
  const salz = randomBytes(16);
  const key = await scryptAsync(klartext, salz, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salz.toString("base64")}$${key.toString("base64")}`;
}

async function passwortPasst(klartext, gespeichert) {
  try {
    const [algo, N, r, p, salz, key] = String(gespeichert).split("$");
    if (algo !== "scrypt") return false;
    const soll = Buffer.from(key, "base64");
    const ist = await scryptAsync(klartext, Buffer.from(salz, "base64"), soll.length,
      { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return soll.length === ist.length && timingSafeEqual(soll, ist);
  } catch { return false; }
}

/* ---------- Sitzungen ---------------------------------------------------- */
const hash = t => createHash("sha256").update(t).digest("hex");

function sitzungStarten(nutzerId) {
  const token = randomBytes(32).toString("base64url");
  const ab = Date.now() + SESSION_TAGE * 24 * 60 * 60 * 1000;
  q.sitzungAnlegen.run(hash(token), nutzerId, ab, new Date().toISOString());
  return token;
}

function cookies(req) {
  const roh = req.headers.cookie || "";
  const out = {};
  for (const teil of roh.split(";")) {
    const i = teil.indexOf("=");
    if (i > 0) out[teil.slice(0, i).trim()] = decodeURIComponent(teil.slice(i + 1).trim());
  }
  return out;
}

function angemeldet(req) {
  const token = cookies(req).sid;
  if (!token) return null;
  const s = q.sitzungLesen.get(hash(token));
  if (!s) return null;
  if (s.laeuft_ab < Date.now()) { q.sitzungLoeschen.run(hash(token)); return null; }
  const n = q.nutzerPerId.get(s.nutzer_id);
  return n ? { nutzer: n, tokenHash: hash(token) } : null;
}

function cookieSetzen(res, token) {
  const teile = [`sid=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${SESSION_TAGE * 24 * 60 * 60}`];
  if (SICHERE_COOKIES) teile.push("Secure");
  res.setHeader("Set-Cookie", teile.join("; "));
}
function cookieLoeschen(res) {
  const teile = ["sid=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (SICHERE_COOKIES) teile.push("Secure");
  res.setHeader("Set-Cookie", teile.join("; "));
}

/* ---------- Bremse gegen Rateraten ---------------------------------------- */
const versuche = new Map();
function bremse(schluessel, maxProFenster = 12, fenster = 15 * 60 * 1000) {
  const jetzt = Date.now();
  const e = versuche.get(schluessel);
  if (!e || jetzt > e.bis) { versuche.set(schluessel, { n: 1, bis: jetzt + fenster }); return true; }
  e.n += 1;
  return e.n <= maxProFenster;
}
setInterval(() => {
  const jetzt = Date.now();
  for (const [k, e] of versuche) if (jetzt > e.bis) versuche.delete(k);
}, 10 * 60 * 1000).unref();

/* ---------- Validierung der Ladekarten ------------------------------------ */
class Fehler extends Error {
  constructor(status, text) { super(text); this.status = status; }
}

const text = (w, max, feld) => {
  const s = String(w ?? "");
  if (s.length > max) throw new Fehler(400, `${feld} ist zu lang (max. ${max} Zeichen).`);
  return s;
};

function preis(w, feld) {
  if (w === null || w === undefined || w === "") return null;
  const n = Number(w);
  if (!Number.isFinite(n) || n < 0 || n > 99) throw new Fehler(400, `${feld} ist kein gültiger Preis.`);
  return Math.round(n * 10000) / 10000;
}

function saubereKarten(roh) {
  if (!Array.isArray(roh)) throw new Fehler(400, "Ladekarten müssen eine Liste sein.");
  if (roh.length > 60) throw new Fehler(400, "Höchstens 60 Ladekarten.");
  return roh.map((k, i) => {
    if (!k || typeof k !== "object") throw new Fehler(400, `Ladekarte ${i + 1} ist ungültig.`);
    const netze = Array.isArray(k.netze) ? k.netze : [];
    if (netze.length > 25) throw new Fehler(400, "Höchstens 25 Netz-Zeilen je Karte.");
    return {
      id: Number.isFinite(Number(k.id)) ? Number(k.id) : i + 1,
      name: text(k.name, 80, "Name"),
      farbe: /^#[0-9a-fA-F]{6}$/.test(String(k.farbe || "")) ? String(k.farbe) : "#5E6B67",
      stand: /^\d{4}-\d{2}-\d{2}$/.test(String(k.stand || "")) ? String(k.stand) : "",
      notiz: text(k.notiz, 600, "Notiz"),
      netze: netze.map(n => ({
        cpos: (Array.isArray(n?.cpos) ? n.cpos : []).slice(0, 25).map(c => text(c, 40, "Betreiber").toLowerCase().trim()).filter(Boolean),
        label: text(n?.label, 60, "Netz"),
        ac: preis(n?.ac, "AC-Preis"),
        dc: preis(n?.dc, "DC-Preis"),
        hpc: preis(n?.hpc, "HPC-Preis")
      }))
    };
  });
}

/* ---------- HTTP-Hilfen --------------------------------------------------- */
function jsonAntwort(res, status, koerper) {
  const b = Buffer.from(JSON.stringify(koerper));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": b.length,
    "Cache-Control": "no-store"
  });
  res.end(b);
}

function koerperLesen(req, maxBytes = 512 * 1024) {
  return new Promise((ok, fehler) => {
    let laenge = 0;
    const teile = [];
    req.on("data", d => {
      laenge += d.length;
      if (laenge > maxBytes) { fehler(new Fehler(413, "Datenpaket zu groß.")); req.destroy(); return; }
      teile.push(d);
    });
    req.on("end", () => {
      if (!teile.length) return ok({});
      try { ok(JSON.parse(Buffer.concat(teile).toString("utf8"))); }
      catch { fehler(new Fehler(400, "Ungültiges JSON.")); }
    });
    req.on("error", fehler);
  });
}

const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 180;

/* ---------- API ----------------------------------------------------------- */
async function api(req, res, pfad) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";

  if (pfad === "/api/status" && req.method === "GET") {
    return jsonAntwort(res, 200, { ok: true });
  }

  if (pfad === "/api/auth/register" && req.method === "POST") {
    if (!bremse("reg:" + ip, 8)) throw new Fehler(429, "Zu viele Versuche. Bitte später erneut.");
    const b = await koerperLesen(req, 8 * 1024);
    const email = String(b.email || "").trim().toLowerCase();
    const passwort = String(b.passwort || "");
    if (!emailOk(email)) throw new Fehler(400, "Bitte eine gültige E-Mail-Adresse angeben.");
    if (passwort.length < 8 || passwort.length > 200) throw new Fehler(400, "Das Passwort braucht mindestens 8 Zeichen.");
    if (q.nutzerPerEmail.get(email)) throw new Fehler(409, "Für diese E-Mail gibt es schon ein Konto.");
    const info = q.nutzerAnlegen.run(email, await passwortHash(passwort), new Date().toISOString());
    cookieSetzen(res, sitzungStarten(Number(info.lastInsertRowid)));
    return jsonAntwort(res, 200, { email });
  }

  if (pfad === "/api/auth/login" && req.method === "POST") {
    if (!bremse("log:" + ip, 12)) throw new Fehler(429, "Zu viele Versuche. Bitte später erneut.");
    const b = await koerperLesen(req, 8 * 1024);
    const email = String(b.email || "").trim().toLowerCase();
    const nutzer = q.nutzerPerEmail.get(email);
    const passt = nutzer ? await passwortPasst(String(b.passwort || ""), nutzer.passwort)
                         : await passwortPasst("leer", "scrypt$16384$8$1$AAAA$AAAA");
    if (!nutzer || !passt) throw new Fehler(401, "E-Mail oder Passwort stimmt nicht.");
    cookieSetzen(res, sitzungStarten(nutzer.id));
    return jsonAntwort(res, 200, { email: nutzer.email });
  }

  if (pfad === "/api/auth/logout" && req.method === "POST") {
    const s = angemeldet(req);
    if (s) q.sitzungLoeschen.run(s.tokenHash);
    cookieLoeschen(res);
    return jsonAntwort(res, 200, { ok: true });
  }

  if (pfad === "/api/auth/me" && req.method === "GET") {
    const s = angemeldet(req);
    if (!s) return jsonAntwort(res, 200, { email: null });
    return jsonAntwort(res, 200, { email: s.nutzer.email });
  }

  const s = angemeldet(req);

  if (pfad === "/api/auth/passwort" && req.method === "POST") {
    if (!s) throw new Fehler(401, "Nicht angemeldet.");
    if (!bremse("pw:" + ip, 10)) throw new Fehler(429, "Zu viele Versuche. Bitte später erneut.");
    const b = await koerperLesen(req, 8 * 1024);
    if (!await passwortPasst(String(b.alt || ""), s.nutzer.passwort)) throw new Fehler(401, "Das alte Passwort stimmt nicht.");
    const neu = String(b.neu || "");
    if (neu.length < 8 || neu.length > 200) throw new Fehler(400, "Das neue Passwort braucht mindestens 8 Zeichen.");
    q.passwortSetzen.run(await passwortHash(neu), s.nutzer.id);
    q.sitzungenLoeschen.run(s.nutzer.id, s.tokenHash);
    return jsonAntwort(res, 200, { ok: true });
  }

  if (pfad === "/api/auth/konto" && req.method === "DELETE") {
    if (!s) throw new Fehler(401, "Nicht angemeldet.");
    const b = await koerperLesen(req, 8 * 1024);
    if (!await passwortPasst(String(b.passwort || ""), s.nutzer.passwort)) throw new Fehler(401, "Das Passwort stimmt nicht.");
    q.nutzerLoeschen.run(s.nutzer.id);
    cookieLoeschen(res);
    return jsonAntwort(res, 200, { ok: true });
  }

  if (pfad === "/api/karten") {
    if (!s) throw new Fehler(401, "Nicht angemeldet.");
    const stand = q.kartenLesen.get(s.nutzer.id);

    if (req.method === "GET") {
      return jsonAntwort(res, 200, stand
        ? { karten: JSON.parse(stand.daten), rev: stand.rev, geaendert: stand.geaendert }
        : { karten: null, rev: 0, geaendert: null });
    }

    if (req.method === "PUT") {
      const b = await koerperLesen(req);
      const karten = saubereKarten(b.karten);
      const basis = Number(b.rev || 0);
      const aktuell = stand ? stand.rev : 0;
      if (basis !== aktuell) {
        return jsonAntwort(res, 409, {
          fehler: "Auf einem anderen Gerät wurde inzwischen gespeichert.",
          karten: stand ? JSON.parse(stand.daten) : null,
          rev: aktuell,
          geaendert: stand ? stand.geaendert : null
        });
      }
      const neu = aktuell + 1;
      const jetzt = new Date().toISOString();
      q.kartenSchreiben.run(s.nutzer.id, JSON.stringify(karten), neu, jetzt);
      return jsonAntwort(res, 200, { karten, rev: neu, geaendert: jetzt });
    }
  }

  throw new Fehler(404, "Unbekannter Endpunkt.");
}

/* ---------- Statische Dateien --------------------------------------------- */
const TYPEN = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8"
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.mobidata-bw.de",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
].join("; ");

async function statisch(req, res, pfad) {
  const rel = pfad === "/" ? "/index.html" : pfad;
  const ziel = path.join(OEFFENTLICH, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!ziel.startsWith(OEFFENTLICH)) throw new Fehler(403, "Verboten.");

  let stat;
  try { stat = await fsp.stat(ziel); } catch { throw new Fehler(404, "Nicht gefunden."); }
  if (!stat.isFile()) throw new Fehler(404, "Nicht gefunden.");

  const endung = path.extname(ziel).toLowerCase();
  const unveraenderlich = /^\/(vendor|icons)\//.test(rel);
  const etag = `W/"${stat.size}-${Number(stat.mtimeMs).toString(36)}"`;

  if (req.headers["if-none-match"] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }

  res.writeHead(200, {
    "Content-Type": TYPEN[endung] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": unveraenderlich ? "public, max-age=31536000, immutable" : "no-cache",
    "ETag": etag,
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY"
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(ziel).pipe(res);
}

/* ---------- Server -------------------------------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const pfad = decodeURIComponent(url.pathname);
  try {
    if (pfad.startsWith("/api/")) return await api(req, res, pfad);
    if (req.method !== "GET" && req.method !== "HEAD") throw new Fehler(405, "Methode nicht erlaubt.");
    return await statisch(req, res, pfad);
  } catch (e) {
    const status = e instanceof Fehler ? e.status : 500;
    if (status === 500) console.error(e);
    if (pfad.startsWith("/api/")) return jsonAntwort(res, status, { fehler: e.message || "Serverfehler." });
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(e.message || "Fehler");
  }
});

server.listen(PORT, () => console.log(`Ladekarte läuft auf http://localhost:${PORT}  (DB: ${DB_PFAD})`));
