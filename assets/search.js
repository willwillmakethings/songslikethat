const serverURL = "localhost:3000";
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");

let timer = setTimeout(() => {}, 1);

searchInput.addEventListener("keyup", checkTimeout);

function checkTimeout() {
    clearTimeout(timer);
    timer = setTimeout(() => {
        searchSongs();
    }, 300)
}

 function searchSongs(){
    var searchTerm = searchInput.value
    console.log(searchTerm);

    const res = await fetch(serverURL + '/searchSongs',
    {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            songName: searchTerm
        })
    })
}
