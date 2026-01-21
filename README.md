# PrimeTime Media Client

Ein einfacher, moderner Desktop-Client für den PrimeTime Mediaserver, entwickelt mit Electron.

## Features

✅ **Authentifizierung**
- Login/Logout mit Token-Verwaltung
- Automatische Session-Wiederherstellung

✅ **Medienbibliothek**
- Grid-Ansicht mit Postern
- Suche nach Titel
- Filter nach Genre und Jahr
- Sortierung (Titel, Datum, Größe)

✅ **Video-Player**
- HTML5 Video-Player
- Automatisches Playback-Tracking
- Position wird gespeichert und wiederhergestellt
- "Weiter schauen"-Funktion

✅ **Metadaten**
- NFO-Informationen (Titel, Jahr, Rating, Plot)
- Poster/Cover-Bilder
- Cast & Crew Informationen
- Genre-Tags

✅ **Favoriten & Watched**
- Medien als Favoriten markieren
- Als gesehen/ungesehen markieren
- Separate Ansichten für Favoriten und "Weiter schauen"

✅ **Moderne UI**
- Dunkles Theme
- Jellyfin-inspiriertes Design
- Responsive Layout
- Smooth Animationen

## Installation

### Voraussetzungen
- Node.js (v18 oder höher)
- PrimeTime Mediaserver läuft auf http://localhost:8080

### Setup

1. **Abhängigkeiten installieren:**
```bash
npm install
```

2. **Anwendung starten:**
```bash
npm start
```

3. **Anwendung bauen (optional):**
```bash
npm run build
```

## Verwendung

### Erster Start

1. Starten Sie den PrimeTime Mediaserver
2. Starten Sie den Client mit `npm start`
3. Geben Sie die Server-URL ein (Standard: http://localhost:8080)
4. Melden Sie sich mit Ihren Zugangsdaten an

### Navigation

- **Home**: Alle Medien
- **Filme**: Nur Filme
- **Serien**: Nur TV-Serien
- **Favoriten**: Ihre markierten Favoriten
- **Weiter schauen**: Unfertige Wiedergaben

### Video abspielen

1. Klicken Sie auf ein Medium in der Bibliothek
2. Im Detail-Modal auf "Abspielen" klicken
3. Der Player öffnet sich automatisch
4. Position wird alle 10 Sekunden gespeichert

### Suche & Filter

- **Suche**: Geben Sie einen Suchbegriff in die Suchleiste ein
- **Genre-Filter**: Wählen Sie ein Genre aus dem Dropdown
- **Jahr-Filter**: Filtern Sie nach Erscheinungsjahr
- **Sortierung**: Sortieren Sie nach Titel, Datum oder Größe

## Projektstruktur

```
PrimeTimeClient/
├── main.js                 # Electron Main Process
├── preload.js             # Security Bridge
├── index.html             # Haupt-HTML
├── package.json           # Projekt-Konfiguration
├── styles/
│   └── main.css          # Alle Styles
├── js/
│   ├── api-client.js     # API-Client für PrimeTime Server
│   └── app.js            # Haupt-Anwendungslogik
└── assets/               # Icons und Bilder
```

## Technologien

- **Electron**: Desktop-Framework
- **HTML5/CSS3**: UI
- **JavaScript (ES6+)**: Logik
- **Fetch API**: HTTP-Requests
- **LocalStorage**: Session-Persistenz

## API-Integration

Der Client nutzt die vollständige PrimeTime API:

- `/auth/login` - Authentifizierung
- `/library` - Medienbibliothek
- `/items/{id}/stream` - Video-Streaming
- `/items/{id}/nfo` - Metadaten
- `/items/{id}/poster` - Cover-Bilder
- `/items/{id}/playback` - Playback-Tracking
- `/favorites` - Favoriten-Verwaltung
- `/watched` - Watched-Status

## Konfiguration

### Server-URL ändern

Die Server-URL wird beim ersten Login gespeichert. Um sie zu ändern:
1. Abmelden
2. Neue URL im Login-Formular eingeben
3. Erneut anmelden

### Client-ID

Jede Client-Instanz erhält eine eindeutige ID für Playback-Tracking.
Diese wird automatisch generiert und in LocalStorage gespeichert.

## Entwicklung

### Development-Modus

```bash
npm start
```

Im Development-Modus werden die DevTools automatisch geöffnet.

### Debugging

- Electron DevTools sind verfügbar (F12)
- Console-Logs für API-Requests
- Fehlerbehandlung mit aussagekräftigen Meldungen

## Bekannte Einschränkungen

- Untertitel werden noch nicht unterstützt
- Transcoding-Profil-Auswahl fehlt noch
- TV-Show-Episoden-Browser ist vereinfacht
- Collections/Playlists-UI fehlt noch

## Zukünftige Features

- [ ] Untertitel-Unterstützung
- [ ] Transcoding-Profil-Auswahl
- [ ] TV-Show-Episoden-Browser
- [ ] Collections/Playlists-Verwaltung
- [ ] Download-Manager für Offline-Viewing
- [ ] Keyboard-Shortcuts
- [ ] Mini-Player-Modus
- [ ] Mehrsprachigkeit

## Lizenz

ISC

## Support

Bei Problemen oder Fragen:
1. Überprüfen Sie, ob der PrimeTime Server läuft
2. Prüfen Sie die Browser-Console auf Fehler
3. Stellen Sie sicher, dass die Server-URL korrekt ist

## Credits

Inspiriert von Jellyfin Desktop Client
