# Background music

Drop one audio file in this folder named **`theme.mp3`** (or `theme.m4a` /
`theme.ogg`). The site picks it up on the next server start — no code change.

With no file here and no `MUSIC_URL` set, the music control does not appear at
all. The site simply stays silent.

## Playing a track hosted elsewhere instead

```bash
MUSIC_URL=https://example.com/beat.mp3 node server.js
```

On Render, add `MUSIC_URL` under **Environment**.

## How it behaves

- Music does **not** start on page load — every browser blocks that. It starts
  on the visitor's first click or key press.
- A "Music on / Music off" control sits in the bottom-left. The choice is
  remembered on that device.
- Playback position carries from the room list to a room page and back, so the
  track does not restart every time someone opens a room.
- Volume is set to 35%, since it is background, not the main event.

## Where to get beats you are allowed to use

| Source | Licence | Attribution |
|---|---|---|
| [Pixabay Music](https://pixabay.com/music/) | Pixabay Content Licence | Not required |
| [Free Music Archive](https://freemusicarchive.org/) | Varies — filter by CC0 / CC BY | Depends on the track |
| [Incompetech](https://incompetech.com/music/royalty-free/) | CC BY | Required — credit Kevin MacLeod |
| [ccMixter](http://dig.ccmixter.org/) | Varies — check each track | Depends on the track |
| [Internet Archive](https://archive.org/details/audio) | Often public domain | Depends on the item |

Check the licence on the individual track, not just the site. "Free to
download" and "free to put on a public website" are not the same thing, and a
rental site counts as commercial use.
