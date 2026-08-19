# Ladekarte

Karte der Ladesäulen mit **Echtzeit-Belegung** und dem Preis, den *deine* Ladekarten an der
jeweiligen Säule kosten. Läuft als installierbare Web-App (PWA) mit Konto: die eigenen Tarife
liegen dann auf dem Server und stehen auf jedem angemeldeten Gerät zur Verfügung.

```
npm start          # Server auf http://localhost:8080
```

Keine Abhängigkeiten, kein Build-Schritt. Voraussetzung ist Node 22.5 oder neuer
(genutzt werden `node:sqlite`, `node:crypto` und `node:http`).

---

## Woher welche Daten kommen

| Angabe | Quelle | Aktualität |
| --- | --- | --- |
| Standort, Name, Betreiber, Leistung | MobiData BW / OCPDB (WFS, ohne Schlüssel) | bei jedem Kartenausschnitt live |
| Frei / belegt / defekt | dieselbe Abfrage, nur Säulen mit `realtime_data_outdated=false` | live, Sekunden bis Minuten alt |
| **Tarifpreise deiner Ladekarten** | **von dir gepflegt** (Editor „Meine Ladekarten“) | **nur so aktuell, wie du sie einträgst** |

Die Preise werden **nicht** automatisch nachgeladen — dafür gibt es keine offene, vollständige
Schnittstelle der Anbieter (siehe „Warum keine Live-Preise“ unten). Deshalb hat jede Ladekarte ein
Feld **„Preise geprüft am“**. Liegt das Datum mehr als vier Monate zurück, weist die Detailansicht
darauf hin; Tarife ändern sich in der Regel quartalsweise.

### Warum keine Live-Preise

Es gibt keinen offiziellen, offenen Endpunkt, über den sich die Endkundenpreise aller
EMP-Tarife (EnBW, EWE Go, ADAC e-Charge, Aral pulse, IONITY …) abfragen ließen. Preise stehen in
AGB, PDFs und Apps, teils standort- und aktionsabhängig. Wer das automatisieren will, hat zwei Wege:

* **Kommerzielle API** – z. B. Chargeprice bietet tarifbezogene Preisdaten gegen Vertrag an.
  Dafür wäre ein Schlüssel nötig, den der Server hält (nicht der Browser).
* **Eigener Abgleich** – regelmäßig die Preisseiten der Anbieter auswerten. Rechtlich und
  technisch wartungsintensiv, weil sich Seiten und Tarifmodelle ändern.

Solange keines von beidem eingebunden ist, ist die manuelle Pflege plus Datumsstempel die ehrliche
Lösung: Was angezeigt wird, ist genau das, was zuletzt eingetragen wurde.

---

## Design und Karte

Das dunkle Design betrifft ausschließlich die Bedienelemente — Leisten, Liste, Detail, Editor,
Konto. **Die Karte selbst bleibt immer hell**, wählbar sind nur:

* **Normalansicht** (OpenStreetMap)
* **Satellitenansicht** (Esri World Imagery)

Auch die Marker behalten in jedem Design dieselben Farben, damit sie auf beiden Kartenarten
gleich gut lesbar bleiben.

---

## Konto und Synchronisierung

* **Ohne Konto** funktioniert alles wie bisher; die Ladekarten liegen im `localStorage`
  dieses Browsers.
* **Mit Konto** (E-Mail + Passwort) liegen sie zusätzlich auf dem Server. Jede Änderung wird
  nach kurzer Verzögerung hochgeladen; beim Start, beim Zurückkehren zur App und nach
  Wiederkehr der Verbindung wird abgeglichen.
* Jeder Datensatz hat eine Revision. Wurde auf einem anderen Gerät gespeichert, antwortet
  der Server mit `409` und die App fragt, **welche Fassung gelten soll** — es wird nichts
  stillschweigend überschrieben.
* Ohne Netz bleibt die App bedienbar; der Punkt am Konto-Symbol zeigt den Zustand
  (grau: nicht angemeldet, gelb: nicht übertragen, grün: abgeglichen, rot: Entscheidung nötig).

Der Zustand des Punkts und der Klartext dazu stehen im Konto-Dialog.

### Sicherheit

* Passwörter als **scrypt**-Hash (N=16384, r=8, p=1, 16 Byte Salz, 64 Byte Schlüssel).
* Sitzungen als 256-Bit-Zufallstoken, in der Datenbank nur als SHA-256-Hash;
  Cookie `HttpOnly`, `SameSite=Lax`, mit `SECURE_COOKIES=1` zusätzlich `Secure`.
* Passwortwechsel meldet alle anderen Geräte ab.
* Einfache Bremse gegen Rateraten je IP für Registrierung, Anmeldung und Passwortwechsel.
* Der Server prüft und normalisiert alle Tarifdaten, bevor er sie speichert.
* Restriktive Content-Security-Policy, `nosniff`, `frame-ancestors 'none'`, kein Inline-Skript.

### Was gespeichert wird

E-Mail, Passwort-Hash, Sitzungstoken-Hashes und die Tarifdaten. **Nicht** gespeichert werden
Standorte, Kartenausschnitte, Ladevorgänge oder Suchverläufe — die Belegungsabfrage geht direkt
vom Browser an MobiData BW, nie über diesen Server.

---

## Als App installieren

Die App bringt Manifest, Icons und einen Service Worker mit:

* **Android / Chrome:** Menü → „App installieren“
* **iOS / Safari:** Teilen → „Zum Home-Bildschirm“
* **Desktop:** Installationssymbol in der Adressleiste

Startet danach ohne Browserleiste. Der Service Worker hält nur die App-Hülle vor
(HTML, CSS, JS, Leaflet, Icons) — Kartenkacheln und Belegungsdaten kommen immer frisch aus
dem Netz, Konto-Anfragen werden nie zwischengespeichert.

---

## Betrieb

| Variable | Vorgabe | Zweck |
| --- | --- | --- |
| `PORT` | `8080` | Port des HTTP-Servers |
| `DB_PATH` | `./data/ladekarte.db` | SQLite-Datei (WAL-Modus) |
| `SECURE_COOKIES` | aus | auf `1` setzen, sobald hinter HTTPS |

```bash
# direkt
PORT=8080 SECURE_COOKIES=1 node server/server.js

# mit Docker
docker compose up -d
```

Vor den Server gehört ein Reverse Proxy mit TLS (Caddy, nginx, Traefik). Ohne HTTPS keine
Anmeldung im Internet — das Cookie wäre sonst mitlesbar. Sicherung: die Datei aus `DB_PATH`
mitsamt `-wal`/`-shm` kopieren, am besten bei gestopptem Dienst.

### API

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/status` | Lebenszeichen |
| `POST` | `/api/auth/register` | Konto anlegen `{email, passwort}` |
| `POST` | `/api/auth/login` | anmelden |
| `POST` | `/api/auth/logout` | abmelden |
| `GET` | `/api/auth/me` | `{email}` oder `{email:null}` |
| `POST` | `/api/auth/passwort` | `{alt, neu}`, meldet andere Geräte ab |
| `DELETE` | `/api/auth/konto` | `{passwort}`, löscht Konto und Daten |
| `GET` | `/api/karten` | `{karten, rev, geaendert}` |
| `PUT` | `/api/karten` | `{karten, rev}` → `200` oder `409` mit Serverfassung |

---

## Aufbau

```
server/server.js          HTTP, Konten, Sitzungen, Tarifspeicher (SQLite)
public/index.html         Gerüst
public/app.css            Design — dunkel nur für die Bedienelemente
public/app.js             Karte, Liste, Detail, Tarif-Editor, Konto, Abgleich
public/sw.js              Service Worker
public/manifest.webmanifest
public/vendor/leaflet/    Leaflet 1.9.4, lokal ausgeliefert (kein CDN)
public/icons/             App-Icons
```

## Grenzen

* Kein „Passwort vergessen“ — dafür bräuchte es einen Mailversand. Passwortwechsel geht nur
  im angemeldeten Zustand.
* Belegungsdaten nur, wo Betreiber sie melden (Deutschland, über MobiData BW / OCPDB).
* Blockiergebühren, Sitzungsgebühren und Grundgebühren fließen nicht in den Vergleich ein;
  sie stehen als Freitext in der Notiz je Ladekarte.
