const serverURL = "http://localhost:3000";
let timer = setTimeout(() => {}, 1);


const searchInput = document.getElementById("search-input");
const suggestions = document.getElementById("suggestions");

searchInput.addEventListener("keyup", checkTimeout);

// click outside search box or results box to close results
window.addEventListener("click", (e) => {
    if(e.target != suggestions && e.target != searchInput && !suggestions.contains(e.target)){
        suggestions.classList.remove("suggestions-visible");
    }
    else if(e.target == searchInput && (searchInput.value != "")){
        setTimeout(() => {
            suggestions.classList.add("suggestions-visible");
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
    console.log(searchTerm);

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

    const songs = await res.json();
    if(songs.status == "success"){
        removeSuggestions();
        suggestions.classList.add("suggestions-visible");
        songs.results.forEach((song) => {
            const button = document.createElement("button");
            button.classList.add("song-inline")

            const albCover = document.createElement("img");
            albCover.src = song[0];
            albCover.alt = "";

            const songName = document.createElement("p");
            songName.textContent = song[1];

            const artistName = document.createElement("span");
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
