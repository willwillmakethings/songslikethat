const express = require('express')
const app = express()
const path = require('path');
const port = 3000

app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.json());

app.set('views', './pages')
app.set('view engine', 'ejs');


app.get('/', (req, res) => {
    res.render('index.ejs')
})

app.post('/search', (req, res) => {
    let { searchTerm } = req.body;

    // get list of songs for the search term
    search();
    async function search() {
        let songsList = (await fetchWebApi(searchTerm)).tracks.items;
    
        // just get song name and artist for the resulting songs
        const songsNameArtistList = songsList.map((song) => [song.album.images[(song.album.images).length - 1].url, song.name, song.artists[0].name])
        // console.log(songsNameArtistList);
        res.status(200).json({ status: "success", results: songsNameArtistList });
    }
})

async function fetchWebApi(searchTerm) {
    const CLIENT_SECRET = "0f1fa37afded4805aecdd12f9b507e90";
    const CLIENT_ID = "a8fbe0e6900049039ec4554f9a51dba9";

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

    // get songs with search term
    const query = new URLSearchParams({
        q: searchTerm,
        type: 'track',
        limit: 10,
        offset: 0,
        market: 'US'
    }).toString();

    const songsRes = await fetch(`https://api.spotify.com/v1/search?${query}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`
        },
    });

    if (!songsRes.ok) {
        throw new Error(`Spotify API error ${res.status}`);
    }

    let songsList = await songsRes.json();
    return songsList;
}

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})