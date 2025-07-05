const serverURL = "http://localhost:3000"
let timer = setTimeout(() => { }, 1);

let songView = 10;
let songSort = "pop-low-high"
let searchResults;
let resultsOffset = 0;

const searchInput = document.getElementById("search-input");
const suggestions = document.getElementById("suggestions");
const similarSongs = document.querySelector(".similar-songs");
const similarSongsList = document.querySelector(".list");

const sortPopup = document.querySelector(".sort-popup")

searchInput.addEventListener("keyup", checkTimeout);

// click outside search box or results box to close results
window.addEventListener("click", (e) => {
    if (e.target != suggestions && e.target != searchInput && !suggestions.contains(e.target)) {
        suggestions.classList.add("hidden");
    }
    else if (e.target == searchInput && (searchInput.value != "")) {
        setTimeout(() => {
            suggestions.classList.remove("hidden");
        }, 300);
    }
})

window.addEventListener('popstate', (event) => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');

    if (query) {
        const [title, artist] = query.split('-').map(decodeURIComponent);
        document.title = `songslike ${title} by ${artist}`;
        searchSimilarSongs(title, artist);
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

function changeSort(element){
    if(element.classList.contains("checked")){ return }
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

function changeView(element){
    if(element.classList.contains("checked")){ return }
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

function updateLoadButton() {
    let loadMore = document.querySelector(".load-more")
    if(songView == searchResults.length){
        loadMore.style.display = "none";
    }
    else {
        loadMore.style.display = "flex";
    }
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
        suggestions.classList.remove("hidden");
        songs.results.forEach((song) => {
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
}

function removeSimilarSongs() {
    let similarSongsResults = document.querySelectorAll(".song-block");
    if (similarSongsResults) {
        for (let i = 0; i < similarSongsResults.length; i++) {
            let child = similarSongsResults[i]
            similarSongsList.removeChild(child)
        }
    }
}

// get the title and artist from the suggestion that was clicked
function getTitleArtist() {
    let title = this.childNodes[1].textContent;
    let artist = this.childNodes[2].textContent;

    updateURL(title, artist);
    searchSimilarSongs(title, artist);
}

// searching for similar songs
async function searchSimilarSongs(title, artist) {
    removeSimilarSongs();
    suggestions.classList.add("hidden");
    similarSongs.classList.remove("hidden");

    document.getElementById("echo-name").textContent = title;
    document.getElementById("echo-artist").textContent = artist;

    const res = await fetch(`${serverURL}/searchSimilar/${encodeURIComponent(title)}-${encodeURIComponent(artist)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
    });

    const results = (await res.json());
    if (results.status == "success") {
        console.log(results)
        searchResults = results.results
        resultsOffset = 0;
        sortSimilarSongs(searchResults);
        createSimilarSongsList(searchResults); 
    }
}

function searchSimilarFromResult(element){
    const song = (this.id).split("%2c")
    const title = song[0];
    const artist = song[1];

    updateURL(title, artist);
    searchSimilarSongs(title, artist)
}

function sortSimilarSongs(){
    switch (songSort){
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

function loadMoreSongs() {
    resultsOffset++;
    if(resultsOffset * songView < searchResults.length){
        return;
        updateLoadButton();
    }
    else{
        createSimilarSongsList(searchResults, resultsOffset * songView)
    }
}

function createSimilarSongsList(songs, offset = 0){
    for(let i = 0 + offset; i < songView + offset; i++){
        setTimeout(() => {
            let track = songs[i];

            const songBlock = document.createElement("div");
            songBlock.classList.add("song-block")

            // song info
            const songInfo = document.createElement("div");
            songInfo.classList.add("song-info")

            const albCover = document.createElement("img");
            if(!track.albumImage){
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
            if(track.appleMusicUrl == null){
                appleMusic.title = "Not on Apple Music"
                appleMusic.classList.add("no-link");
            }
            else{
                appleMusic.title = "Open in Apple Music"
                appleMusic.href = track.appleMusicUrl;
                appleMusic.target = "_blank"
            }

            const appleMusicImg = document.createElement("img")
            appleMusicImg.src = "/img/apple-music.svg"
            appleMusicImg.alt = "";

            const spotify = document.createElement("a")
            if(track.spotifyUrl == null){
                spotify.title = "Not on Spotify"
                spotify.classList.add("no-link");
            }
            else{
                spotify.title = "Open in Spotify"
                spotify.href = track.spotifyUrl;
                spotify.target = "_blank"
            }

            const spotifyImg = document.createElement("img")
            spotifyImg.src = "/img/spotify.svg"
            spotifyImg.alt = "";

            const amazonMusic = document.createElement("a")
            if(track.amazonMusicUrl == null){
                amazonMusic.title = "Not on Amazon Music"
                amazonMusic.classList.add("no-link");
            }
            else{
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

            // search similar
            const searchSimilar = document.createElement("button")
            searchSimilar.classList.add("song-similar");
            searchSimilar.textContent = "Songs like this"
            searchSimilar.onclick = searchSimilarFromResult;
            searchSimilar.id = `${track.title}%2c${track.artist}`

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
            console.log("song added to page");
        }, 100 * i);
    }
}

// update the url to reflec the song the user searched
function updateURL(title, artist) {
    const query = `${encodeURIComponent(title)}-${encodeURIComponent(artist)}`;
    const newURL = `${window.location.origin}/?q=${query}`;

    history.pushState({ title, artist }, '', newURL);
    document.title = `songslike ${title} by ${artist}`;
}