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
        let songId = (await fetchSpotifyApi(title, artist)).tracks.items[0].id;
        // let results = (await findSimilarSongs(songId));
        // console.log("results", results);
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