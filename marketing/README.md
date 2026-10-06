# Marketing — Social-Media-Pipeline

Ziel: Kurzvideos (9:16) für TikTok, Instagram Reels und YouTube Shorts, die
Spieler auf **https://modulo-realms-one.vercel.app** bringen. Möglichst alles
automatisch; nur Kontoerstellung, Logins und API-Freigaben braucht einen Menschen.

## Videos bauen

```bash
npm run dev                                    # Dev-Server (Szenen brauchen window.game)
node marketing/record.mjs <szene> raw.webm     # Rohclip, 640x960, Spielton, ~28 fps
node marketing/record.mjs <szene> f.png --still  # nur Standbild zum Framing
node marketing/edit.mjs raw.webm out.mp4 --hook "TEXT" --sub "TEXT" --start 1 --dur 15
```

- Szenen: `marketing/scenes.mjs` (Ort, Uhrzeit, Klasse, Level, Gegner). Autopilot kämpft selbst.
- Aufgenommen wird nur das Welt-Canvas (kein HUD). Godmode an, damit nichts stirbt.
- `edit.mjs`: 2× Nearest-Neighbour auf 1080x1920, Hook-Text oben (0–4,5 s), optionale
  Unterzeile, Endkarte „Play free in your browser“ + URL, Lautheit −14 LUFS, H.264/AAC.
- Schrift = die Pixel-Schrift des Spiels (`export-font.mjs`, Cache in `marketing/.cache/`,
  nicht eingecheckt).
- **Videos nie ins Repo** (Projektregel: keine Binär-Assets). Ablage: Google Drive / Scratchpad.

## Konten (Stand)

| Plattform | Handle-Wunsch | Status |
| --- | --- | --- |
| TikTok | @modulorealms | vom User anzulegen (Handy-Verifikation) |
| Instagram | @modulorealms | vom User anzulegen, dann auf **Creator-Konto** umstellen |
| YouTube | @modulorealms | Kanal im Google-Konto modulorealms@gmail.com |

Kontoerstellung per Bot ist bei TikTok/Instagram verboten und führt zur Sperre — das macht ein Mensch.

## Hochladen (Ausbaustufen)

1. **Jetzt:** Videos + fertige Captions landen auf Google Drive, User postet vom Handy (2 min/Video).
2. **YouTube Data API v3:** OAuth-Client (Google Cloud, Typ „TVs and Limited Input devices“),
   Gerätecode-Login einmalig durch den User → Uploads per Skript. Ohne Google-Audit sind
   API-Uploads zunächst **privat**.
3. **Instagram Graph API** (Reels): Creator-/Business-Konto + Facebook-Seite + Meta-App.
4. **TikTok Content Posting API:** Developer-App; ohne Audit nur private Posts →
   bis dahin Upload als Entwurf, User drückt „Posten“.

## Analyse

Nach 48 h je Video: Views, durchschnittliche Wiedergabedauer, Shares, Follower-Zuwachs,
Klicks auf die Spiel-URL (Vercel Analytics, `?utm_source=tiktok|instagram|youtube`).
Log in `marketing/log.md`, Wochenbericht, nächste Videos nach dem, was trägt.
