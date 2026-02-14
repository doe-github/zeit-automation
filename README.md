# ZEIT Buchung Automation

Automatische Zeitbuchung via Playwright - lokal am Mac, ausgelöst vom iPhone.

## Actions

| Action | Beschreibung |
|--------|--------------|
| `normal` | Normalbuchung (Kommen/Gehen) |
| `mittag` | Mittagspause |

## Setup

### 1. Dependencies installieren
```bash
npm install
npx playwright install chromium
```

### 2. Credentials konfigurieren
Kopiere `.env.example` zu `.env` und trage deine Daten ein:
```bash
cp .env.example .env
```

Dann editiere `.env`:
```
ZEIT_USER=dein_login_username
ZEIT_PASS=dein_login_passwort
MITARBEITER_USER=deine_mitarbeiternummer
MITARBEITER_PASS=deine_pin
```

## Lokales Testen

```bash
# Normalbuchung (Kommen/Gehen)
npm run normal
npm run normal:dev   # mit Browser sichtbar
npm run normal:slow  # langsam zum Zuschauen

# Mittagspause
npm run mittag
npm run mittag:dev   # mit Browser sichtbar
npm run mittag:slow  # langsam zum Zuschauen
```

## Vom iPhone auslösen

### Schritt 1: Server am Mac starten
```bash
npm run server
```
Der Server läuft auf `http://0.0.0.0:8787`

### Schritt 2: Mac IP-Adresse herausfinden
```bash
ipconfig getifaddr en0
```
Beispiel: `192.168.1.42`

### Schritt 3: iPhone Kurzbefehle erstellen

**Kurzbefehl 1: "ZEIT Kommen/Gehen"**
1. Kurzbefehle App → **+**
2. Aktion: **URL abrufen**
3. URL: `http://192.168.1.42:8787/trigger?action=normal`
4. Methode: `POST`

**Kurzbefehl 2: "ZEIT Mittagspause"**
1. Kurzbefehle App → **+**
2. Aktion: **URL abrufen**
3. URL: `http://192.168.1.42:8787/trigger?action=mittag`
4. Methode: `POST`

### Schritt 4: Auslösen
- Tippe auf den Kurzbefehl
- Oder sage "Hey Siri, ZEIT Kommen Gehen"

## API Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/health` | GET | Server-Status |
| `/status` | GET | Letzter Run |
| `/trigger?action=normal` | POST/GET | Normalbuchung |
| `/trigger?action=mittag` | POST/GET | Mittagspause |

## Wichtige Hinweise

⚠️ **Der Mac muss eingeschaltet sein** und der Server muss laufen (`npm run server`)

⚠️ **iPhone und Mac müssen im gleichen WLAN sein**

⚠️ **Credentials werden NICHT eingecheckt** (`.env` ist in `.gitignore`)

## Scripts

| Befehl | Beschreibung |
|--------|--------------|
| `npm run normal` | Normalbuchung headless |
| `npm run mittag` | Mittagspause headless |
| `npm run normal:dev` | Normalbuchung mit Browser |
| `npm run mittag:dev` | Mittagspause mit Browser |
| `npm run server` | Trigger-Server starten |
| `npm run codegen` | Neuen Flow aufzeichnen |
