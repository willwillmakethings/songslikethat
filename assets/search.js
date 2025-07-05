const serverURL = "http://localhost:3000"
let timer = setTimeout(() => { }, 1);
let songsPerPage = 10;
let songSort = "pop-low-high"
let i = 0;

const searchInput = document.getElementById("search-input");
const suggestions = document.getElementById("suggestions");
const similarSongs = document.querySelector(".similar-songs");

const sortPopup = document.querySelector(".sort-popup")
const sortFilters = document.querySelectorAll("input[type='radio']");
const sortLabels = Array.from(document.querySelectorAll("label"))
const sortFiltersArray = Array.from(sortFilters);

searchInput.addEventListener("keyup", checkTimeout);

sortPopup.addEventListener("click", (e) => {
    // registers two clicks sometimes (one on the label and one on the input) but i only care about the ones on the inputs
    // definitely can be cleaned up
    if(sortLabels.includes(e.target)){
        return;
    }
    else{
        // did they click on the label itself...
        if (sortFiltersArray.includes(e.target)) {
            sortFilters.forEach((filter) => {
                if (filter.id != e.target.id && filter.name == e.target.name) {
                    filter.parentElement.classList.remove("checked");
                }
                else if (filter.id == e.target.id && filter.name == e.target.name) {
                    filter.parentElement.classList.add("checked");
                    if(filter.name == "view") { songsPerPage = parseInt(filter.id); }
                    else { songSort = filter.id}
                }
            });
        }
        // or did they click on the div that is around the label
        else if (sortFiltersArray.includes(e.target.firstElementChild)) {
            sortFilters.forEach((filter) => {
                if (filter.id != e.target.firstElementChild.id && filter.name == e.target.firstElementChild.name) {
                    filter.parentElement.classList.remove("checked");
                }
                else if (filter.id == e.target.firstElementChild.id && filter.name == e.target.firstElementChild.name) {
                    filter.parentElement.classList.add("checked");
                    if(filter.name == "view") { songsPerPage = parseInt(filter.id); }
                    else { songSort = filter.id}
                }
            });
        }
    }
});

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
        document.title = `${title}, ${artist} - songslikethat`;
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
    let searchResults = document.querySelectorAll(".song-inline");
    if (searchResults) {
        for (let i = 0; i < searchResults.length; i++) {
            let child = searchResults[i]
            suggestions.removeChild(child)
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

    const results = await res.json();
    if (results.status == "success") {
        console.log(results)
        // TODO: handle list of similar songs and show them to user
    }
}

// update the url to reflec the song the user searched
function updateURL(title, artist) {
    const query = `${encodeURIComponent(title)}-${encodeURIComponent(artist)}`;
    const newURL = `${window.location.origin}/?q=${query}`;

    history.pushState({ title, artist }, '', newURL);
    document.title = `${title}, ${artist} - songslikethat`;
}