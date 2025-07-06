const express = require('express')
const app = express()
const path = require('path');
const port = 3000

require('dotenv').config();

app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.json());

app.set('views', './pages')
app.set('view engine', 'ejs');

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})

app.get('/', (req, res) => {
    res.render('index.ejs')
})

app.post('/search', (req, res) => {
    let { searchTerm } = req.body;
    getSuggestions();

    // get and send list of songs for the search term
    async function getSuggestions() {
        let results = (await fetchSpotifyApi(searchTerm)).tracks.items;
        let suggestions = deDuplicate(results, 10)
        res.status(200).json({ status: "success", results: suggestions });
    }
})

app.post('/searchSimilar/:title-:artist', (req, res) => {
    var { title, artist } = req.params;
    getSimilar();

    // get and send similar songs for input song
    async function getSimilar() {
        let results = (await findSimilarSongs(title, artist));
        res.status(200).json({ status: "success", results: results});
    }
})

async function fetchSpotifyApi(title, artist = "") {
    let token = await getToken();
    let query;

    if (artist != "") {
        // get the actual song after we've searched for it with title + artist
        query = new URLSearchParams({
            q: title, artist,
            type: 'track',
            limit: 1,
            offset: 0,
            market: 'US'
        }).toString();
    }
    else {
        // get suggested results from just searching the title
        query = new URLSearchParams({
            q: title,
            type: 'track',
            limit: 50,
            offset: 0,
            market: 'US'
        }).toString();
    }

    const songsRes = await fetch(`https://api.spotify.com/v1/search?${query}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        },
    });

    if (!songsRes.ok) {
        throw new Error(`Spotify API error ${songsRes.status}`);
    }

    let songsList = await songsRes.json();
    return songsList;
}

async function getRelatedArtists(artistName) {
    const TASTEDIVE_API_KEY = process.env.TASTEDIVE_API_KEY
    const query = encodeURIComponent(artistName);

    const res = await fetch(
        `https://tastedive.com/api/similar?q=${query}&type=music&info=0&limit=10&k=${TASTEDIVE_API_KEY}`
    );

    if (!res.ok) {
        console.error("TasteDive API error:", await res.text());
        return [];
    }

    const json = await res.json();
    const results = json?.similar?.results || [];

    // Extract just the artist names
    const artistNames = results.map(entry => entry.name);
    return artistNames;
}

async function findSimilarSongs(title, artist) {
  let token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };

  const relatedArtistNames = await getRelatedArtists(artist);
  const allTracks = [];

  for (const name of relatedArtistNames) {
    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      // 1. Search for artist
      const artistSearchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`;
      const artistData = await retryFetchJSON(artistSearchUrl, { headers });

      const artistId = artistData?.artists?.items?.[0]?.id;
      if (!artistId) continue;

      // 2. Get top tracks
      const topTracksUrl = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`;
      const topTrackData = await retryFetchJSON(topTracksUrl, { headers });
      const topTracks = topTrackData.tracks || [];

      // 3. Format and push
      for (const track of topTracks.slice(0, 5)) {
        allTracks.push({
          id: track.id,
          title: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          albumImage: track.album.images?.[0]?.url || null,
          spotifyUrl: track.external_urls.spotify,
          appleMusicUrl: await getAppleMusicUrl(track.name, name),
          amazonMusicUrl: `https://www.amazon.com/s?k=${encodeURIComponent(track.name + ' ' + name)}&i=digital-music`,
          previewUrl: track.preview_url,
          popularity: track.popularity,
          release_date: track.album.release_date
        });
      }
    } catch (err) {
      console.warn(`Error fetching for "${name}":`, err.message);
    }
  }

  return allTracks;
}

// helper functions
async function retryFetchJSON(url, options = {}, maxRetries = 3, delay = 300) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${err.message}`);
      }
      console.warn(`Retrying (${attempt}/${maxRetries})... ${url}`);
      await new Promise(resolve => setTimeout(resolve, delay * attempt)); // exponential backoff
    }
  }
}

async function getToken() {
    const CLIENT_SECRET = process.env.CLIENT_SECRET;
    const CLIENT_ID = process.env.CLIENT_ID;

    // get access token
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
        },
        body: "grant_type=client_credentials"
    })

    let token = (await tokenRes.json()).access_token;
    return token
}

async function getAppleMusicUrl(title, artist) {
  const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title + ' ' + artist)}&entity=song&limit=1`);
  const data = await res.json();
  return data.results?.[0]?.trackViewUrl || null;
}

function deDuplicate(songsList, maxLength) {
    let seen = new Set();
    const uniqueTracks = [];

    // filter for 10 unique results
    for (const track of songsList) {
        const artist = track.artists[0]?.name?.toLowerCase().trim();
        const name = track.name.toLowerCase().replace(/\*/g, '').trim();
        const key = `${artist}-${name}`;

        if (!seen.has(key)) {
            seen.add(key);
            uniqueTracks.push(track);
        }

        if (uniqueTracks.length === maxLength) break;
    }

    // format for frontend
    let artistList = [];
    let suggestions = [];

    for (let i = 0; i < uniqueTracks.length; i++) {
        let artists = ""

        for (let j = 0; j < uniqueTracks[i].artists.length; j++) {
            artists += uniqueTracks[i].artists[j].name;
            if (j != uniqueTracks[i].artists.length - 1) {
                artists += ", "
            }
        }

        artistList[i] = artists;
        suggestions[i] = [uniqueTracks[i].album.images[(uniqueTracks[i].album.images).length - 1].url, uniqueTracks[i].name, artistList[i]]
    }

    return suggestions;
}