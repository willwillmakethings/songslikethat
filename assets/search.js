const serverURL = "http://localhost:3000"
let timer = setTimeout(() => { }, 1);

let songView = 10;
let songSort = "pop-low-high"
let resultsOffset = 0;
let searchSuggestions;
let searchResults;

/* array of [[Song, Results], ...]
where:
1. song is an object with song.artist, song.title, and song.albumImage
representing the song that was searched for

2. results is an array of songs representing the similar songs to Song
**/
let cachedResults = [];

let headerCurve = document.getElementById("header-curve");

const searchInput = document.getElementById("search-input");
const suggestions = document.getElementById("suggestions");
const similarSongs = document.querySelector(".similar-songs");
const similarSongsList = document.querySelector(".list");

const listHeader = document.querySelector(".list-header");
const sortPopup = document.querySelector(".sort-popup")
const toTop = document.getElementById("to-top");

const loadMore = document.querySelector(".load-more")
const loadButton = document.querySelector(".load-button")
const noMore = document.getElementById("noMoreSongs");

const cardScroller = document.querySelector(".card-scroller")

searchInput.addEventListener("keyup", checkTimeout);

toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" })
    toTop.classList.add("to-top-visible");
    toTop.classList.remove("to-top-focus")
    toTop.blur();
})

toTop.addEventListener("focus", () => {
    toTop.classList.add("to-top-visible");
    toTop.classList.add("to-top-focus")
})

toTop.addEventListener("blur", () => {
    toTop.classList.remove("to-top-visible")
    toTop.classList.remove("to-top-focus")
})

// click outside search box or results box to close results
window.addEventListener("click", (e) => {
    if (e.target != suggestions && e.target != searchInput && !suggestions.contains(e.target)) {
        removeSuggestions();
    }
    else if (e.target == searchInput && (searchInput.value != "")) {
        createSuggestions(searchSuggestions);
    }
})

window.addEventListener("resize", () => {
    listHeader.style.marginTop = headerCurve.clientHeight + "px";
})

window.addEventListener("scroll", () => {
    const rect = listHeader.getBoundingClientRect();
    if (rect.top <= 0) {
        toTop.classList.add("to-top-visible")
    }
    else {
        toTop.classList.remove("to-top-visible")
    }
})

window.addEventListener('popstate', (event) => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');

    if (query) {
        const [title, artist] = query.split('-').map(decodeURIComponent);
        document.title = `songslike ${title} by ${artist}`;
        // searchSimilarSongs(title, artist);
        // searchFromCache
    }
});

// check if the user pauses typing before searching for matching songs
function checkTimeout() {
    clearTimeout(timer);
    timer = setTimeout(() => {
        if (searchInput.value) {
            getSuggestions();
        }
    }, 300)
}

// get suggestions for what the user type, and allow them to search for a song
async function getSuggestions() {
    var searchTerm = searchInput.value

    const res = await fetch(serverURL + '/search',
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                searchTerm: searchTerm
            })
        })

    let songs = await res.json();
    if (songs.status == "success") {
        removeSuggestions();
        searchSuggestions = songs.results;
        createSuggestions(songs.results);
    }
}

// clear previous results before adding new ones
function removeSuggestions() {
    let searchSuggestions = document.querySelectorAll(".song-inline");
    if (searchSuggestions) {
        for (let i = 0; i < searchSuggestions.length; i++) {
            let child = searchSuggestions[i]
            suggestions.removeChild(child)
        }
    }
    suggestions.classList.add("hide-suggestions");
}

// update the url to reflec the song the user searched
function updateURL(title, artist) {
    const query = `${encodeURIComponent(title)}-${encodeURIComponent(artist)}`;
    const newURL = `${window.location.origin}/?q=${query}`;

    history.pushState({ title, artist }, '', newURL);
    document.title = `songslike ${title} by ${artist}`;
}

// get the title and artist from the suggestion that was clicked
function getTitleArtist() {
    let albumImage = this.childNodes[0].src;
    let title = this.childNodes[1].textContent;
    let artist = this.childNodes[2].textContent;

    updateURL(title, artist);
    searchSimilarSongs(title, artist, albumImage);
}

// searching for similar songs
async function searchSimilarSongs(title, artist, albumImage = "") {
    removeSimilarSongs();
    removeSuggestions();
    similarSongs.classList.remove("hidden");
    listHeader.style.marginTop = headerCurve.clientHeight + "px";

    document.getElementById("echo-name").textContent = title;
    document.getElementById("echo-artist").textContent = artist;
    resultsOffset = 0;

    const res = await fetch(`${serverURL}/searchSimilar/${encodeURIComponent(title)}-${encodeURIComponent(artist)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
    });

    const results = (await res.json());
    if (results.status == "success") {
        searchResults = results.results
        console.log("search results", searchResults)

        // cache results and search title/artist/albumImage
        let song = ({albumImage: albumImage, title: title, artist: artist })
        cachedResults.unshift({ song: song, results: searchResults })
        console.log("cached results", cachedResults);
        if (cachedResults.length >= 5) {
            cachedResults.pop();
        }

        sortSimilarSongs(searchResults);
        createSimilarSongsList(searchResults);
        createRecentSearch(song, searchResults)
    }
}

function removeSimilarSongs() {
    loadButton.classList.add("hidden")
    noMore.classList.add("hidden")
    let similarSongsResults = document.querySelectorAll(".song-block");
    if (similarSongsResults) {
        for (let i = 0; i < similarSongsResults.length; i++) {
            let child = similarSongsResults[i]
            similarSongsList.removeChild(child)
        }
    }
}

function searchSimilarFromResult() {
    const song = (this.id).split("%2c")
    const title = song[0];
    const artist = song[1];
    const albumImage = song[2];

    updateURL(title, artist);
    searchSimilarSongs(title, artist, albumImage)
}

function sortSimilarSongs() {
    switch (songSort) {
        case "pop-high-low":
            searchResults.sort((a, b) => b.popularity - a.popularity);
            break;
        case "pop-low-high":
            searchResults.sort((a, b) => a.popularity - b.popularity);
            break;
        case "date-new-old":
            searchResults.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
            break;
        case "date-old-new":
            searchResults.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
            break;
    }
}

function changeSort(element) {
    if (element.classList.contains("checked")) { return }
    else {
        resultsOffset = 0;
        document.getElementById(songSort).classList.remove("checked");
        songSort = element.id;
        element.classList.add("checked")
        sortSimilarSongs();
        removeSimilarSongs();
        createSimilarSongsList(searchResults);
    }
}

function changeView(element) {
    if (element.classList.contains("checked")) { return }
    else {
        resultsOffset = 0;
        document.getElementById(songView).classList.remove("checked");
        songView = parseInt(element.id);
        element.classList.add("checked")
        removeSimilarSongs();
        createSimilarSongsList(searchResults);
        updateLoadButton();
    }
}

function loadMoreSongs() {
    resultsOffset++;
    if (resultsOffset * songView > searchResults.length) {
        updateLoadButton();
        return;
    }
    else {
        let offset = resultsOffset * songView
        createSimilarSongsList(searchResults, offset)
    }
}

function updateLoadButton() {
    if (similarSongsList.childNodes.length >= searchResults.length || resultsOffset * songView >= searchResults.length) {
        loadButton.classList.add("hidden")
        noMore.classList.remove("hidden")
    }
    else {
        loadButton.classList.remove("hidden")
        noMore.classList.add("hidden")
    }
}

// use cached searched results to load results fast
function searchFromCache() {
    removeSimilarSongs();
    let searchId = parseInt(this.id);
    let title = cachedResults[searchId].song.title;
    let artist = cachedResults[searchId].song.artist;

    document.getElementById("echo-name").textContent = title;
    document.getElementById("echo-artist").textContent = artist;
    window.scrollTo({top: 0, left: 0, behavior: "smooth"});

    updateURL(title, artist)
    createSimilarSongsList(cachedResults[searchId].results);
}

// functions to dynamically build search suggestions, search results, and recent searches

function createSuggestions(songs) {
    songs.forEach((song) => {
        const button = document.createElement("button");
        button.classList.add("song-inline")
        button.onclick = getTitleArtist;

        const albCover = document.createElement("img");
        albCover.src = song[0];
        albCover.alt = "";

        const songName = document.createElement("p")
        songName.id = "songName";
        songName.textContent = song[1];

        const artistName = document.createElement("span");
        artistName.id = "artistName"
        artistName.textContent = song[2];

        button.appendChild(albCover);
        button.appendChild(songName);
        button.appendChild(artistName);
        suggestions.appendChild(button);
    });
    suggestions.classList.remove("hide-suggestions");
}

function createSimilarSongsList(songs, offset = 0) {
    for (let i = 0 + offset; i < songView + offset; i++) {
        setTimeout(() => {
            updateLoadButton();
            let track = songs[i];

            const songBlock = document.createElement("div");
            songBlock.classList.add("song-block")

            // song info
            const songInfo = document.createElement("div");
            songInfo.classList.add("song-info")

            const albCover = document.createElement("img");
            if (!track.albumImage) {
                albCover.src = "/img/placeholder.jpg"
            }
            else {
                albCover.src = track.albumImage;
            }
            albCover.alt = "";

            const songName = document.createElement("p")
            songName.textContent = track.title;

            const artistName = document.createElement("span");
            artistName.textContent = track.artist;

            songInfo.appendChild(albCover)
            songInfo.appendChild(songName)
            songInfo.appendChild(artistName)

            // song links
            const songLinks = document.createElement("div")
            songLinks.classList.add("song-links")

            const appleMusic = document.createElement("a")
            if (track.appleMusicUrl == null) {
                appleMusic.title = "Not on Apple Music"
                appleMusic.classList.add("no-link");
            }
            else {
                appleMusic.title = "Open in Apple Music"
                appleMusic.href = track.appleMusicUrl;
                appleMusic.target = "_blank"
            }

            const appleMusicImg = document.createElement("img")
            appleMusicImg.src = "/img/apple-music.svg"
            appleMusicImg.alt = "";

            const spotify = document.createElement("a")
            if (track.spotifyUrl == null) {
                spotify.title = "Not on Spotify"
                spotify.classList.add("no-link");
            }
            else {
                spotify.title = "Open in Spotify"
                spotify.href = track.spotifyUrl;
                spotify.target = "_blank"
            }

            const spotifyImg = document.createElement("img")
            spotifyImg.src = "/img/spotify.svg"
            spotifyImg.alt = "";

            const amazonMusic = document.createElement("a")
            if (track.amazonMusicUrl == null) {
                amazonMusic.title = "Not on Amazon Music"
                amazonMusic.classList.add("no-link");
            }
            else {
                amazonMusic.title = "Open in Spotify"
                amazonMusic.href = track.amazonMusicUrl;
                amazonMusic.target = "_blank"
            }

            const amazonMusicImg = document.createElement("img")
            amazonMusicImg.src = "/img/amazon-music.svg"
            amazonMusicImg.alt = "";

            // playback
            const preview = document.createElement("div")
            preview.classList.add("song-playback")

            const playPause = document.createElement("button")
            playPause.classList.add("play");
            // playPause.onclick = playPreview;

            preview.appendChild(playPause)

            // search similar
            const searchSimilar = document.createElement("button")
            searchSimilar.classList.add("song-similar");
            searchSimilar.textContent = "Songs like this"
            searchSimilar.onclick = searchSimilarFromResult;
            searchSimilar.id = `${track.title}%2c${track.artist}%2c${track.albumImage}`

            appleMusic.appendChild(appleMusicImg)
            spotify.appendChild(spotifyImg)
            amazonMusic.appendChild(amazonMusicImg)

            songLinks.appendChild(appleMusic)
            songLinks.appendChild(spotify)
            songLinks.appendChild(amazonMusic)

            const actions = document.createElement("div")
            actions.classList.add("row")

            actions.appendChild(songLinks)
            actions.appendChild(preview)
            actions.appendChild(searchSimilar)

            songBlock.appendChild(songInfo)
            songBlock.appendChild(actions)

            similarSongsList.appendChild(songBlock);
        }, 100 * i);
    }
}

// create recent search card
function createRecentSearch(song, results) {
    let numCards = document.querySelectorAll(".card").length
    let recentPlaceholder = document.querySelector(".recent-placeholder")
    if(recentPlaceholder){
        recentPlaceholder.remove();
    }

    // create card
    const card = document.createElement("button");
    card.classList.add("card");
    card.id = `${numCards}`
    card.onclick = searchFromCache

    // "songs like" card title
    const cardTitle = document.createElement("p")
    cardTitle.textContent = "songs like"

    // info about song for recent search
    const searchSongInfo = document.createElement("div")
    searchSongInfo.classList.add("song-info")

    let title = document.createElement("p")
    let artist = document.createElement("span")
    let album = document.createElement("img");
    album.src = song.albumImage
    album.alt = "";
    title.textContent = song.title;
    artist.textContent = song.artist

    searchSongInfo.appendChild(album)
    searchSongInfo.appendChild(title)
    searchSongInfo.appendChild(artist)

    // top three similar search results
    const top3 = document.createElement("div")
    top3.classList.add("top-3")

    for (let i = 0; i < 3; i++) {
        const result = document.createElement("div")
        let title = document.createElement("p")
        let artist = document.createElement("span")
        let album = document.createElement("img");
        result.classList.add("song-info-small")
        album.src = results[i].albumImage;
        album.alt = "";
        album.id = `title${i + 1}`
        album.width = 50;
        title.textContent = results[i].title;
        title.id = `title${i + 1}`
        artist.textContent = results[i].artist;
        artist.id = `artist${i + 1}`

        result.appendChild(album)
        result.appendChild(title)
        result.appendChild(artist)
        top3.appendChild(result)
    }

    // "search again" label on hover
    const searchAgain = document.createElement("span")
    searchAgain.classList.add("label")
    searchAgain.textContent = "Search Again";

    // put it together and put in the carousel
    card.appendChild(cardTitle);
    card.appendChild(searchSongInfo);
    card.appendChild(top3);
    card.appendChild(searchAgain);

    cardScroller.insertBefore(card, cardScroller.firstChild)

    if(numCards >= 5){
        cardScroller.removeChild(cardScroller.lastChild);
    }
}

