const serverURL = "http://localhost:3000"
let timer = setTimeout(() => {}, 1);

const searchInput = document.getElementById("search-input");
const suggestions = document.getElementById("suggestions");
const similarSongs = document.querySelector(".similar-songs");

searchInput.addEventListener("keyup", checkTimeout);

// click outside search box or results box to close results
window.addEventListener("click", (e) => {
    if(e.target != suggestions && e.target != searchInput && !suggestions.contains(e.target)){
        suggestions.classList.add("hidden");
    }
    else if(e.target == searchInput && (searchInput.value != "")){
        setTimeout(() => {
            suggestions.classList.remove("hidden");
        }, 300);
    }
})

// check if the user pauses typing before searching for matching songs
function checkTimeout() {
    clearTimeout(timer);
    timer = setTimeout(() => {
        if(searchInput.value) {
            searchSongs();
        }
    }, 300)
}

// get the song that the user searched for
async function searchSongs(){
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
    if(songs.status == "success"){
        removeSuggestions();
        suggestions.classList.remove("hidden");
        songs.results.forEach((song) => {
            const button = document.createElement("button");
            button.classList.add("song-inline")
            button.onclick = searchSong;

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
function removeSuggestions(){
    let searchResults = document.querySelectorAll(".song-inline");
    console.log(searchResults);
    if(searchResults){
        for(let i = 0; i < searchResults.length; i++){
            let child = searchResults[i]
            suggestions.removeChild(child)
        }
    }
}

// searching for songs
function searchSong(){
    let title = this.childNodes[1].textContent;
    let artist = this.childNodes[2].textContent;

    suggestions.classList.add("hidden");
    similarSongs.classList.remove("hidden");
    document.getElementById("echo-name").textContent = title;
    document.getElementById("echo-artist").textContent = artist;

    searchSimilarSongs(title, artist);
}

async function searchSimilarSongs(title, artist){
    const res = await fetch(serverURL + '/searchSimilar',
    {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            title: title,
            artist: artist
        })
    })

    const songs = await res.json();
    if(songs.status == "success"){
        console.log(songs)
        // removeSuggestions();
        // suggestions.classList.remove("hidden");
        // songs.results.forEach((song) => {
        //     const button = document.createElement("button");
        //     button.classList.add("song-inline")
        //     button.onclick = searchSong;

        //     const albCover = document.createElement("img");
        //     albCover.src = song[0];
        //     albCover.alt = "";

        //     const songName = document.createElement("p")
        //     songName.id = "songName";
        //     songName.textContent = song[1];

        //     const artistName = document.createElement("span");
        //     artistName.id = "artistName"
        //     artistName.textContent = song[2];

        //     button.appendChild(albCover);
        //     button.appendChild(songName);
        //     button.appendChild(artistName);
        //     suggestions.appendChild(button);
        // });
    }
}