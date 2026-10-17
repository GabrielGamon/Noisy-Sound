# Noisy Sound

**My personal music app: just music, no ads.**

Noisy Sound is a music streaming app built for the iPhone. It takes the best ideas from SoundCloud and Spotify and leaves out everything that gets in the way of listening. There are no ads, no podcasts, no audiobooks, no video feeds and no social clutter. You open it, music is already there, and it learns what you like as you listen.

Live app: **https://gabrielgamon.github.io/Noisy-Sound/**

---

## Table of contents

1. [What it is](#what-it-is)
2. [Installing it on the iPhone](#installing-it-on-the-iphone)
3. [Using the app](#using-the-app)
4. [Where the music comes from](#where-the-music-comes-from)
5. [How recommendations work](#how-recommendations-work)
6. [Design](#design)
7. [Under the hood](#under-the-hood)
8. [Project structure](#project-structure)
9. [Running it locally](#running-it-locally)
10. [Deploying updates](#deploying-updates)
11. [Privacy](#privacy)
12. [Limitations](#limitations)
13. [Ideas for the future](#ideas-for-the-future)

---

## What it is

Noisy Sound is a **Progressive Web App (PWA)**. That means it is a website that behaves like a native app. When you add it to the iPhone Home Screen, it gets its own icon, opens full screen without the Safari address bar, keeps working in the background and shows its controls on the lock screen and in Control Center.

Building it as a PWA was a deliberate choice:

- **No Mac required.** Native iOS apps must be compiled with Xcode, which only runs on macOS. A PWA can be built and published from any computer, including Windows.
- **No App Store and no yearly fee.** Installing a native app on your own phone either expires every 7 days (free Apple ID) or costs US$ 99/year (Apple Developer Program). A PWA has neither limit.
- **Instant updates.** Every time the code is pushed to GitHub, the app updates itself the next time it is opened.

The main ideas:

- **Only music.** Podcasts, audiobooks, spoken word, comedy and kids' content are filtered out of every list.
- **Zero ads.** Nothing interrupts the music, and no banners appear anywhere.
- **Easy to use.** Three tabs, big touch targets, and no setup. Music is ready the moment you open it.
- **The music is the design.** The colors of the app adapt to the cover art of whatever is playing.

---

## Installing it on the iPhone

1. Open **https://gabrielgamon.github.io/Noisy-Sound/** in **Safari** (it has to be Safari for the Home Screen install to work on iOS).
2. Tap the **Share** button (the square with an arrow).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open Noisy Sound from its new icon.

From then on it runs like any other app. To pick up a new version after an update, close the app from the app switcher and open it again (sometimes twice, because the first launch downloads the new version in the background and the second one uses it).

It also works in any desktop browser (Chrome, Edge, Firefox, Safari) at the same address. The layout adapts to wide screens.

---

## Using the app

The app has three tabs at the bottom, a mini player that floats above them, and a full-screen player.

### Home (Início)

The home screen greets you according to the time of day ("Bom dia", "Boa tarde", "Boa noite") and is built from these sections:

- **Destaque da semana (Weekly highlight).** A large card featuring the number one trending track of the week, with its cover art blurred in the background. Tap anywhere on it to play.
- **Shortcuts.** Quick access to your **Curtidas** (liked songs) and your most recent playlists.
- **Feito para você (Made for you).** A personal mix built from the genres and artists you listen to most. It appears once you have listened to a few songs and refreshes itself as your taste changes.
- **Porque você ouviu… (Because you listened to…).** One shelf for each of the last two different artists you played, for example *"Because you listened to Mochakk"*. Each shelf has tracks from similar artists and from the same style.
- **Gêneros (Genres).** A row of colorful genre cards, such as MPB, Reggae, R&B, Hip-Hop and Trap.
- **Tocadas recentemente (Recently played).** The songs you played last, as a horizontal shelf of covers.
- **Em alta esta semana (Trending this week).** A numbered chart of what is popular right now. Tap **Ver tudo (See all)** to open the full list.

All horizontal shelves scroll sideways and respect the screen margins at the start and at the end, so nothing sticks to the edge.

### Search (Pesquisar)

- A **search field** at the top finds songs and artists by name. Results appear as you type.
- When the field is empty, the screen shows a **grid of genres**:
  MPB, Reggae, R&B, Hip-Hop, Trap, Funk, Pop, Sertanejo, Pagode, Eletrônica, House, Rock, Lo-Fi, Jazz, Latina, Dancehall, Acústico and Ambiente.
- Tapping a genre opens a page with that genre's tracks, with **Tocar (Play)** and **Aleatório (Shuffle)** buttons.

### Library (Biblioteca)

Three filters at the top:

- **Curtidas (Likes):** every song you tapped the heart on, newest first, with Play and Shuffle buttons.
- **Playlists:** create, rename and delete your own playlists. Add songs to them from the **•••** menu on any track.
- **Artistas (Artists):** the artists of the songs you liked or saved in playlists. Tap one to see their most played tracks.

### The track menu (•••)

Every song has a **•••** button with:

- **Tocar a seguir (Play next):** puts the song right after the current one in the queue.
- **Curtir (Like)** or **Remover das curtidas (Unlike).**
- **Adicionar à playlist (Add to playlist),** including creating a new playlist on the spot.
- **Ver artista (Go to artist).**
- **Remover desta playlist (Remove from this playlist),** when you are inside a playlist.

### The player

Tap the mini player to open the full-screen player. It has:

- **Large cover art** that gently shrinks when paused and grows when playing.
- **Background glow** in the main color of the cover.
- **A waveform progress bar,** inspired by SoundCloud but cleaner. Tap or drag on it to jump to any point of the song.
- **Elapsed and remaining time.**
- **Controls:** shuffle, previous, play/pause, next and repeat. Repeat cycles through *off → repeat all → repeat one*.
- **Like button** and a **•••** menu for the current track.
- **Swipe down** anywhere on the player to close it.

The current song is also shown on the **lock screen and in Control Center**, with play/pause, next, previous and seeking, through the Media Session API.

### Keep playing (radio)

When the queue ends and repeat is off, the music doesn't stop. The app finds songs similar to the last one, adds them to the queue and keeps playing, showing a short "Tocando músicas parecidas" (Playing similar songs) message.

---

## Where the music comes from

All music comes from **[Audius](https://audius.co)**, an open music streaming platform where artists upload and share their own tracks, much like SoundCloud. Audius offers a public, free API that allows third-party apps to browse its catalog and stream full tracks. No API key, account or payment is needed.

That is why the app can come pre-filled with music and doesn't ask you to import anything.

How each section maps to the catalog:

| Section | What the app asks Audius for |
| --- | --- |
| Trending this week | `GET /v1/tracks/trending?time=week` |
| Genre pages (Reggae, R&B, Hip-Hop, Pop, Electronic, Rock, Lo-Fi, Jazz, Latin, House, Trap, Dancehall, Acoustic, Ambient) | `GET /v1/tracks/trending?genre=<Audius genre>` |
| Brazilian styles that are not official Audius genres (MPB, Funk, Sertanejo, Pagode) | `GET /v1/tracks/search?query=<name>` |
| Search | `GET /v1/tracks/search?query=<text>` |
| Artist page | `GET /v1/users/<id>/tracks?sort=plays` |
| Similar artists (for recommendations) | `GET /v1/users/<id>/related` |
| Playing a song | `GET /v1/tracks/<id>/stream`, played by the browser's audio engine |

Before the first request, the app checks that `api.audius.co` responds. If it doesn't, it asks that address for the list of Audius discovery servers and picks one that works. If nothing answers, the screens show a "couldn't load the songs, check your connection" message with a **Try again** button.

Every list goes through a filter that removes tracks that can't be streamed and anything tagged as Podcasts, Audiobooks, Spoken Word, Comedy, Kids or Devotional, so the app stays music only.

**Why not Spotify, YouTube or SoundCloud?**

- **Spotify** and **YouTube** protect their audio and their terms forbid other apps from pulling it out, so they cannot be used as a source.
- **SoundCloud** only lets outside apps play tracks through its official embedded player and has stopped handing out new API keys, so there is no way to offer its catalog with search and genres. An earlier version of Noisy Sound played SoundCloud links. It was replaced by the Audius catalog so that music is available without adding anything.

---

## How recommendations work

Noisy Sound has its own small recommendation engine (`recommend.js`). It runs entirely on the device and learns from **that person's own listening**, so everyone who uses the app gets recommendations based on their own taste.

### 1. Listening history

Every time a song starts playing, the app saves a small entry with the track id, artist, genre and time. It keeps up to the last 300 plays.

### 2. Taste profile

From that history and your likes, the app builds a profile:

- Each play adds **1 point** to that song's genre and artist.
- Recent plays count a bit more than old ones (up to **2×** for the most recent).
- Each liked song adds **3 points** to its genre and artist, because a like says more than a single play.

The top 3 genres and top 3 artists make up your profile.

### 3. "Made for you" (Feito para você)

1. Fetch what is trending in each of your top genres.
2. Fetch songs from artists similar to your favorite artist.
3. **Blend** these lists by taking one track from each list in turn, so the mix stays varied.
4. Remove songs you have already heard and allow at most **2 songs per artist**.
5. Keep up to 40 tracks.

If you have heard almost everything available, it allows repeats so the mix is never empty. If there is no history yet, it falls back to the weekly trending chart. The mix is rebuilt automatically every 4 songs you play, so it follows your mood.

### 4. "Because you listened to…" (Porque você ouviu…)

For each of the last two different artists you played:

1. Look up **related artists** on Audius and take a few of each one's most played tracks.
2. Add what is trending in the **same genre** as the song you heard.
3. Blend them, leave out the original artist and the songs you already heard, and keep up to 30 tracks.

### 5. Radio when the queue ends

The same "similar songs" logic runs when the queue ends. Up to 20 new songs are added after the last one and playback continues.

---

## Design

The look is dark, clean and focused on the cover art.

- **Colors:** an almost black background (`#0b0b0d`), white text and a single accent color. The accent is taken from the **most vivid color of the current cover art**, so the whole app (buttons, progress bar, waveform, background glow) changes color with every song. When a cover can't be read, a color is generated from the song name, so every track still has its own look.
- **Typography:** the iPhone's system font (SF Pro), large bold titles with slightly tight letter spacing, and few weight changes.
- **Layout:** rounded corners everywhere, soft shadows and generous spacing. Horizontal shelves snap to cards and keep the screen margin.
- **Covers without art** get a gradient with the first letter of the title.
- **Genre cards** each have their own gradient and a translucent shape in the corner, like album stickers.
- **Glass effects:** the mini player and the tab bar use a blurred translucent background.
- **Motion:** short, spring-like animations when opening the player, showing menus (bottom sheets) and pressing buttons.
- **Responsive:** on phones the content uses the full width with 20px margins. On larger screens it is centered with a maximum width and 32px margins, and the genre grid adds columns to fill the space.
- **iPhone details:** respects the notch and home-indicator safe areas, uses the black translucent status bar, and avoids text selection and tap highlights.

---

## Under the hood

Noisy Sound is written in **plain HTML, CSS and JavaScript**. It has no framework, no build step and no dependencies, which keeps it small, fast and easy to change.

- **Rendering:** each screen is a function that returns HTML for the current state (`renderHome`, `renderLibrary`, `renderCollection`…). A single `render()` call redraws the visible screen. Clicks are handled by one listener on the document that reads `data-*` attributes (`data-play`, `data-go`, `data-menu`…).
- **Contexts:** every list of songs has a context name, such as `trend`, `genre:Reggae`, `q:<search>`, `artist:<id>:<name>`, `for:you`, `like:<artistId>:<name>:<genre>`, `liked`, `pl:<playlistId>` or `recent`. Playing a song from a list plays that context as a queue. That is also how the player knows what to show at the top ("Reggae", "Curtidas", "Parecidas com Mochakk"…).
- **Remote lists** are fetched once per session and kept in memory. While loading, a three-dot animation is shown.
- **Queue and shuffle:** the queue keeps the original order, plus a separate play order that is shuffled when shuffle is on. The current song is always kept first, so turning shuffle on and off doesn't interrupt the music.
- **Audio:** a single `<audio>` element streams the track URL. This is what allows background playback and lock-screen controls on iOS.
- **Storage:** IndexedDB (`db.js`) stores the songs you interacted with, your likes, playlists, recently played, listening history and settings (shuffle and repeat). Everything survives closing the app, and the app asks the browser to keep this data persistent.
- **Offline shell:** a service worker (`sw.js`) caches the app's own files, so the interface opens instantly and even without internet. It always tries the network first, so updates arrive as soon as they are published. Streaming music does need a connection.
- **Waveform:** drawn on a `<canvas>` as rounded bars. Audius doesn't provide waveform data, so each song gets a unique, stable shape generated from its id. The played part is painted in the accent color.
- **Cover colors:** the cover is drawn into a tiny 24×24 canvas and the most saturated, mid-brightness pixel becomes the accent hue.

---

## Project structure

```
Noisy-Sound/
├── index.html            App shell: header, tabs, mini player, full player, bottom sheet
├── style.css             All styles (layout, components, player, genres, responsive rules)
├── app.js                Screens, navigation, queue, player UI, likes and playlists
├── catalog.js            Audius API client and the list of genres
├── recommend.js          Taste profile and recommendations ("Made for you", "Because you listened to…", radio)
├── player.js             Audio engine wrapper around the <audio> element
├── db.js                 Tiny IndexedDB helper (tracks, playlists, settings)
├── sw.js                 Service worker for the offline app shell
├── manifest.webmanifest  PWA manifest (name, icons, colors, standalone mode)
├── icons/                App icons (SVG and PNG for the Home Screen)
└── .nojekyll             Tells GitHub Pages to serve the files as they are
```

---

## Running it locally

There is nothing to install or build. Serve the folder with any static server and open it in a browser:

```bash
# Python
python -m http.server 8080

# or Node
npx serve .
```

Then open `http://localhost:8080`. Use the browser's device toolbar (F12 → toggle device) to preview it at iPhone size.

Opening `index.html` directly as a file also mostly works, but the service worker only runs over `http://localhost` or `https://`.

---

## Deploying updates

The app is hosted for free on **GitHub Pages**, from the `main` branch, root folder.

1. Change the files.
2. If you changed any file the app caches, bump the cache name at the top of `sw.js` (for example `noisy-sound-v5` → `noisy-sound-v6`) so old copies are cleaned up.
3. Commit and push to `main`.
4. GitHub Pages republishes within a minute or two.
5. On the iPhone, close and reopen the app (once or twice) to load the new version.

---

## Privacy

- There is **no account, no login and no server of its own**.
- Likes, playlists and listening history are stored **only on the device**, in the browser's storage for this site. They are never uploaded anywhere.
- The only outside requests go to the Audius API (to list and stream music) and to Audius servers for cover images.
- Removing the app from the Home Screen and clearing Safari's website data deletes everything it stored.

---

## Limitations

- **Catalog:** Audius is mostly independent and electronic artists. Big label artists that are on Spotify or YouTube are usually not there, and some Brazilian styles (MPB, Sertanejo, Pagode) can have fewer options.
- **Internet:** songs are streamed, so you need a connection to play. The interface itself opens offline.
- **Background playback:** iOS is stricter with web apps than with native apps. Playback usually continues with the screen locked, but iOS can occasionally pause it after a long time in the background.
- **Data on one device:** because everything is stored locally, likes and playlists don't sync between devices, and clearing Safari data erases them.
- **Similar artists:** if Audius doesn't return related artists for someone, recommendations rely on the genre only.

---

## Ideas for the future

- Infinite scroll on long lists (load more as you reach the bottom).
- Artist pages with photo, follower count and top tracks.
- A visible queue screen with drag-to-reorder.
- Sleep timer.
- Export and import of likes and playlists, to move them to another device.
- Optional sync of likes and playlists between devices.
- Mood filters (chill, energetic, focus) using Audius' mood tags.
- Light theme.
