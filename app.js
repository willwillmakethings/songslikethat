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

app.get('/templates', (req, res) => {
  res.render('templates.ejs')
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

app.post('/searchSimilar/:id', (req, res) => {
  var { id } = req.params;
  getSimilar();

  // get and send similar songs for input song
  async function getSimilar() {
    let results = await findSimilarSongs(id);
    res.status(200).json({ status: "success", results: results });
  }
})

app.post('/getSongInfo/:id', (req, res) => {
  var { id } = req.params;
  getSong();

  // get and send similar songs for input song
  async function getSong() {
    let results = await songFromId(id);
    res.status(200).json({ status: "success", results: results });
  }
})

// takes in spotify id, returns song object
async function songFromId(id){
  let token = await getToken();
  const IdRes = await fetch(`https://api.spotify.com/v1/tracks/${id}?market=us`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    },
  });

  if (!IdRes.ok) {
    throw new Error(`Spotify API error ${IdRes.status}, ${IdRes.message}`);
  }

  let track = (await IdRes.json());
  return track;
}

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

async function findSimilarSongs(id) {
  let token = await getToken();
  let searchedSong = await songFromId(id)
  let title = searchedSong.name;
  let artist = searchedSong.artists[0].name;

  // get similar songs with lastfm
  const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

  let query = new URLSearchParams({
    method: "track.getsimilar",
    track: title,
    artist: artist,
    api_key: LASTFM_API_KEY,
    format: "json",
    limit: 25
  }).toString();

  let similarRes = await fetch(`https://ws.audioscrobbler.com/2.0/?${query}`);
  let similarResults = (await similarRes.json()).similartracks.track;

  if(similarResults.length == 0){
    query = new URLSearchParams({
      method: "artist.getsimilar",
      artist: artist,
      api_key: LASTFM_API_KEY,
      format: "json",
      limit: 25,
    }).toString();

    similarRes = await fetch(`https://ws.audioscrobbler.com/2.0/?${query}`);
    similarResults = (await similarRes.json()).similarartists.artist;
    console.log("similar artists found: ")

    // we dont have 50 songs, so we have to handle building the list of similar songs differently
    let similarSongs = await getSimilarFromArtists(similarResults, token);
    return similarSongs;
  }

  console.log("similar songs found: ")

  // get info for each song (no need to get top songs from artists)
  let similarSongs = await getSongsOnSpotify(similarResults)
  similarSongs = parseSimilarSongInfo(similarSongs);
  return similarSongs;
}

// helper functions
function artistNameFromArray(array) {
  return (array.map((artist) => (artist.name)))
}

// return an array of the top two songs from an array of artists
async function getSimilarFromArtists(similarArtists, token) {
  let songs = [];
  const headers = { Authorization: `Bearer ${token}` };

  for(let i = 0; i < similarArtists.length; i++){
    let artist = similarArtists[i].name;

    const artistSearchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=artist&limit=1`;
    const artistData = await fetch(artistSearchUrl, { headers });
    let res = await artistData.json();

    const artistId = res?.artists?.items?.[0]?.id;

    const topTracksUrl = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`;
    const topTrackData = await fetch(topTracksUrl, { headers });
    res = await topTrackData.json();

    const topTracks = res.tracks;
    for(const track of topTracks.slice(0, 1)){
      songs.push(track)
    }
  }

  // parse info from spotify
  const similarSongs = parseSimilarSongInfo(songs)
  return similarSongs
}

// parse the info from lastfm
async function parseSimilarSongInfo(similarSongs) {
  let songs = [];
  for(const track of similarSongs){
    let artist = artistNameFromArray(track.artists).slice(0, 1).join(', ');
    songs.push({
      id: track.id,
      title: track.name,
      artist: artist,
      albumImage: track.album.images?.[0]?.url || null,
      spotifyUrl: track.external_urls.spotify,
      appleMusicUrl: await getAppleMusicUrl(track.name, artist),
      amazonMusicUrl: `https://www.amazon.com/s?k=${encodeURIComponent(track.name + ' ' + artist)}&i=digital-music`,
      previewUrl: await getDeezerPreview(track.name, artist),
      popularity: track.popularity,
      release_date: track.album.release_date
    })
  }
  return songs;
}

async function getDeezerPreview(title, artist) {
  let query = new URLSearchParams({
    index: '0',
    limit: '1',
    output: 'json'
  }).toString();

  const songsRes = await fetch(`https://api.deezer.com/search/track?q=artist:"${artist}" track"${title}"&${query}`, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    },
  });
  
  let deezerResult = await songsRes.json();
  if(!deezerResult.data.length == 0) { return deezerResult.data[0].preview }
  else { return null }
}

async function getSongsOnSpotify(songs){
  let spotifySongs = [];
  for(song of songs){
    let spotify = (await fetchSpotifyApi(song.name, song.artist.name)).tracks.items[0]
    spotifySongs.push(spotify)
  }
  return spotifySongs
}

async function getToken() {
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const CLIENT_ID = process.env.CLIENT_ID;

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
  if(!res.ok){
    return null
  }
  const data = await res.json();
  return data.results?.[0]?.trackViewUrl || null;
}

function deDuplicate(songsList, maxLength) {
  let seen = new Set();
  const uniqueTracks = [];

  // filter for 10 unique results
  for (const track of songsList) {
    const artist = track.artists[0]?.name?.toLowerCase().trim();
    const name = track.name.toLowerCase().replace(/\s*\(from [^)]+\)/gi, '').replace(/\*/g, '').trim();
    const key = `${artist}-${name}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueTracks.push(track);
    }

    if (uniqueTracks.length === maxLength) break;
  }

  // format for frontend
  let suggestions = [];

  for (let i = 0; i < uniqueTracks.length; i++) {
    suggestions[i] = {
      title: uniqueTracks[i].name,
      artist: {
          all: artistNameFromArray(uniqueTracks[i].artists).join(', '),
          first: uniqueTracks[i].artists[0]
        },
      albumImage: uniqueTracks[i].album.images[(uniqueTracks[i].album.images).length - 1].url,
      id: uniqueTracks[i].id
    }
  }

  return suggestions;
}