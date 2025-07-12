const serverURL = "http://localhost:3000"
let timer = setTimeout(() => { }, 1);

let songView = 10;
let songSort = "pop-low-high"
let resultsOffset = 0;
let searchSuggestions;
let searchResults;

/* array of [{Song, Results}, ...]
where:
1. song is an object with song.artist.all, song.title, and song.albumImage
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
const loader = document.querySelector(".loader")
const breadcrumbs = document.getElementById("breadcrumbs")
const arrow = document.getElementById("arrow");

const sortButton = document.querySelector(".sort-toggle")
const sortPopup = document.querySelector(".sort-popup")
const toTop = document.getElementById("to-top");

const loadMore = document.querySelector(".load-more")
const loadButton = document.querySelector(".load-button")
const noMore = document.getElementById("noMoreSongs");

const cardScroller = document.querySelector(".card-scroller")
const scrollWrapper = document.querySelector(".card-scroller-wrapper")
const scrollRight = document.getElementById("scroll-right")
const scrollLeft = document.getElementById("scroll-left")

searchInput.addEventListener("keyup", checkTimeout);

scrollRight.addEventListener("click", () => {
    scrollWrapper.scrollLeft += 398;
})

scrollLeft.addEventListener("click", () => {
    scrollWrapper.scrollLeft -= 398;
})

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

sortButton.addEventListener("focus", () => {
    suggestions.classList.add("hide-suggestions")
    removeSuggestions();
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
    const query = params.get('id');

    if (query) {
        const id = query;
        updateTitle(id)
        searchFromCacheOrNew(id)
    }
});

window.addEventListener("DOMContentLoaded", () => {
    const loadedCachedResults = loadCachedResultsFromStorage();
    if (loadedCachedResults) {
        cachedResults = loadedCachedResults;
        createRecentCards(cachedResults);
    }

    else {
        // check if the url has search terms in it, and if so, search!
        const params = new URLSearchParams(window.location.search);
        const query = params.get('id');

        if (query) {
            const id = query;
            updateTitle(id)
            searchSimilarSongs(id)
        }
    }
})

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
function updateURL(id) {
    const query = `${encodeURIComponent(id)}`;
    const newURL = `${window.location.origin}/?id=${query}`;

    history.pushState(id, '', newURL);
    updateTitle(id)
}

async function updateTitle(id) {
    let song = await songInfoFromId(id)
    document.title = `songslike ${(song.title)} by ${song.artist.first}`;
}

// get the title and artist from the suggestion that was clicked
function getTitleArtist() {
    loader.remove();
    const id = this.id;
    searchSimilarSongs(id);
}

async function songInfoFromId(id) {
    const infoRes = await fetch(`${serverURL}/getSongInfo/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
    });

    let data = await infoRes.json()
    let song = {
        title: data.results.name,
        artist: {
            all: formatArtistNames((data.results.artists).map((artist) => artist.name)),
            first: data.results.artists[0].name,
        },
        albumImage: data.results.album.images[2].url,
        id: id
    }

    return song;
}

// searching for similar songs
async function searchSimilarSongs(id) {
    removeSimilarSongs();
    removeSuggestions();
    removeHomeBlurb();

    similarSongs.classList.remove("hidden");
    similarSongs.insertBefore(loader, similarSongsList)
    listHeader.style.marginTop = headerCurve.clientHeight + "px";

    createBreadcrumb(id);
    updateURL(id);
    resultsOffset = 0;

    const res = await fetch(`${serverURL}/searchSimilar/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
    });

    const results = (await res.json());
    if (results.status == "success") {
        searchResults = results.results

        // cache results and search title/artist/albumImage
        addToCache(id, searchResults)

        sortSimilarSongs(searchResults);
        createSimilarSongsList(searchResults);
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

function removeHomeBlurb() {
    let home = document.querySelector(".home");
    if (home) { home.remove() };
}

async function createBreadcrumb(id) {
    removeBreadcrumbs();

    let song = await songInfoFromId(id);

    let breadcrumbCount = document.querySelectorAll("li").length
    let newArrow = arrow.cloneNode(true);
    newArrow.classList.remove("hidden");

    let breadcrumb = document.createElement("li")
    breadcrumb.setAttribute("data-index", breadcrumbCount)

    let title = document.createElement("b")
    let artistText = document.createElement("b");
    title.textContent = song.title;
    title.id = "title";
    artistText.textContent = formatArtistNames(song.artist.all, false, 3);
    artistText.id = "artist"

    breadcrumb.append(title, " by ", artistText)
    breadcrumbs.append(breadcrumb);
}

function removeBreadcrumbs() {
    let allBreadcrumbs = document.querySelectorAll("li");
    let visibleArrows = document.querySelectorAll("#arrow");

    for (let i = allBreadcrumbs.length - 1; i >= 0; i--) {
        allBreadcrumbs[i].remove()
        if (!visibleArrows[i].classList.contains("hidden")) {
            visibleArrows[i].remove()
        }
    }
}

function searchSimilarFromResult() {
    searchFromCacheOrNew(this.id);
}

function sortSimilarSongs() {
    switch (songSort) {
        case "pop-low-high":
            searchResults.sort((a, b) => b.popularity - a.popularity);
            break;
        case "pop-high-low":
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
    if (!searchResults || similarSongsList.childNodes.length >= searchResults.length || resultsOffset * songView >= searchResults.length) {
        loadButton.classList.add("hidden")
        noMore.classList.remove("hidden")
    }
    else {
        loadButton.classList.remove("hidden")
        noMore.classList.add("hidden")
    }
}

// use cached searched results to load results fast
async function searchFromCache(cachedEntry) {
    removeHomeBlurb()
    removeSimilarSongs();
    let id;
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    similarSongs.classList.remove("hidden");
    console.log(this)

    /* is this function being called from searchFromCacheOrNew **/
    if (this && this.id !== undefined) {
        index = getCachedResultIndex(this.id)
        console.log("this.id is undefined")
        id = this.id;
        addToCache(cachedResults[index].id, cachedResults[index].results)
        createSimilarSongsList(cachedResults[index].results);
    }
    /* or is this function being called from pressing on one of the recent search cards **/
    else {
        id = cachedEntry.id
        console.log("pressed on a card")
        addToCache(cachedEntry.id, cachedEntry.results)
        createSimilarSongsList(cachedEntry.results);
    }

    updateURL(id)
    createBreadcrumb(id)

    similarSongs.classList.remove("hidden");
    listHeader.style.marginTop = headerCurve.clientHeight + "px";
    resultsOffset = 0;
}

// checks if the title and artist are in the cache
// if yes: pulls results from cache without loading for 5+ seconds
// if no: creates a new search 
function searchFromCacheOrNew(id) {
    const cachedEntry = cachedResults.find(entry => { return entry.id === id });
    console.log(cachedEntry);

    if (cachedEntry) {
        searchResults = cachedEntry.results;
        console.log(searchResults)
        searchFromCache(cachedEntry);
    } else {
        searchSimilarSongs(id); // fallback to API search
    }
}

// if the song/results are in the cache already, remove them before adding them again
// if not, just add them like normal
function addToCache(id, results) {
    if (!Array.isArray(cachedResults)) cachedResults = [];

    const cacheIndex = getCachedResultIndex(id);

    if (cacheIndex !== -1) {
        const cards = document.querySelectorAll(".card");
        if (cards[cacheIndex]) cards[cacheIndex].remove();
        cachedResults.splice(cacheIndex, 1);
    }

    cachedResults.unshift({ id, results });

    if (cachedResults.length > 6) {
        cachedResults.pop();
    }

    saveCachedResultsToStorage();
    createRecentSearch(id, results);
}

function saveCachedResultsToStorage() {
    try {
        console.log("cached results saved ", cachedResults);
        translateCache(cachedResults);
        localStorage.setItem('cachedResults', JSON.stringify(cachedResults));
    } catch (e) {
        console.warn("Failed to save cachedResults to localStorage:", e);
    }
}

async function translateCache(cache) {
    let transCache = [];
    for (let i = 0; i < cache.length; i++) {
        let song = await songInfoFromId(cache[i].id);
        transCache.push({ song: song, results: cache[i].results });
    }
    console.log("cached results (translated) ", transCache)

}

function loadCachedResultsFromStorage() {
    try {
        const data = JSON.parse(localStorage.getItem('cachedResults') || '[]');
        console.log("cached results loaded", data);
        return data;
    } catch (e) {
        console.warn("Failed to load cachedResults from localStorage:", e);
        return null;
    }
}

function getCachedResultIndex(id) {
    return cachedResults.findIndex(entry => entry.id === id);
}

// returns a formatted string containing the names of the artists for a song
// takes in an array of artist names and a boolean 
// if format is true, turns full artists array into comma separated string
// if format is false (assuming artists is a string), splits artists back into an array,
// extracts the first n names, and counts the rest of the names into one '+n more' string,
// and adds it to the end of the artist names
function formatArtistNames(artists, format = true, n = 3) {
    if (format) {
        return artists.join(', ');
    }
    else {
        const firstN = artists.split(', ').slice(0, n).join(', ');
        const moreCount = artists.split(', ').length - n;
        if (moreCount > 0) {
            return `${firstN}, +${moreCount} more`;
        }
        else {
            return firstN
        }
    }
}

function openLinksButton(button) {
    (button.parentNode).classList.toggle("open")
    if ((button.parentNode).classList.contains("open")) {
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>'
    }
    else {
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 512"><path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z"/></svg>'
    }
}

// functions to dynamically build search suggestions, search results, and recent searches
function createSuggestions(songs) {
    songs.forEach((song) => {
        const button = document.createElement("button");
        button.classList.add("song-inline")
        button.id = `${song.id}`;
        button.onclick = getTitleArtist;

        const albCover = document.createElement("img");
        albCover.src = song.albumImage;
        albCover.alt = "";

        const songName = document.createElement("p")
        songName.id = "songName";
        songName.textContent = song.title;

        const artistName = document.createElement("span");
        artistName.id = "artistName"
        artistName.textContent = song.artist.all;

        button.append(albCover, songName, artistName)
        suggestions.appendChild(button);
    });
    suggestions.classList.remove("hide-suggestions");
}

function createSimilarSongsList(songs, offset = 0) {
    loader.remove();
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

            songInfo.append(albCover, songName, artistName)

            // song links
            const songLinks = document.createElement("div")
            songLinks.classList.add("song-links")

            const links = createLinkImages(track);
            songLinks.append(links.appleMusic, links.spotify, links.amazonMusic)

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
            searchSimilar.id = `${track.id}`

            const actions = document.createElement("div")
            actions.classList.add("row")
            actions.append(songLinks, preview, searchSimilar)

            songBlock.append(songInfo, actions)

            similarSongsList.appendChild(songBlock);
        }, 100 * i);
    }
}

// create recent search card
async function createRecentSearch(id, results) {
    let song = await songInfoFromId(id);

    // create card
    const card = document.createElement("a");
    card.classList.add("card");
    card.id = `${song.id}`
    card.tabIndex = "0";
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
    artist.textContent = song.artist.all

    searchSongInfo.append(album, title, artist)

    // top three similar search results
    const top3 = document.createElement("div")
    top3.classList.add("top-3")

    let n = 0;
    for (let i = 0; i < results.length; i++) {
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

        let moreLinks = document.createElement("div")
        let openButton = document.createElement("button")
        moreLinks.classList.add("links")
        openButton.addEventListener("click", (e) => {
            e.stopPropagation();
            openLinksButton(openButton);
        })
        openButton.id = "openButton"
        openButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 512"><path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z"/></svg>'

        const links = createLinkImages(results[i]);
        moreLinks.append(openButton, links.appleMusic, links.spotify, links.amazonMusic)

        result.append(album, title, artist, moreLinks)
        top3.appendChild(result)

        if (i >= 2) {
            n = results.length - i;
            break;
        }
    }

    const nMore = document.createElement("span")
    nMore.textContent = `+${n} More`

    top3.appendChild(nMore);

    // "search again" label on hover
    const searchAgain = document.createElement("span")
    searchAgain.classList.add("label")
    searchAgain.textContent = "Resume Search";

    // put it together and put in the carousel
    card.append(cardTitle, searchSongInfo, top3, searchAgain)

    cardScroller.insertBefore(card, cardScroller.firstChild)
    document.querySelector(".recent-inner").classList.remove("hidden")

    let numCards = document.querySelectorAll(".card").length
    if (numCards > 6) {
        cardScroller.removeChild(cardScroller.lastChild);
    }
}

async function createRecentCards(cache) {
    for (let i = 0; i < cache.length; i++) {
        let id = cache[i].id;
        let results = cache[i].results;

        createRecentSearch(id, results)
    }

    const params = new URLSearchParams(window.location.search);
    const query = params.get('id');

    if (query) {
        const id = query;
        updateTitle(id)
        searchFromCacheOrNew(id)    
    }
}

function createLinkImages(track) {
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
    appleMusic.append(appleMusicImg)

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
    spotify.append(spotifyImg)

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
    amazonMusic.append(amazonMusicImg);

    return {appleMusic: appleMusic, spotify: spotify, amazonMusic: amazonMusic}
}