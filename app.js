const express = require('express')
const app = express()
const path = require('path');
const port = 3000

app.use(express.static(path.join(__dirname, 'assets')));
app.set('views', './pages')
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index.ejs')
})

app.post('/searchSongs', (req, res) => {
    let songName = req.body.songName;
    songName = songName.replace(/(<([^>]+)>)/ig, "");
    let endpoint = `https://api.spotify.com/v1/search?q=${songName}&type=track&market=EN&limit=10&offset=0`

    search()
    async function search() {
        try {
          const response = await fetch(endpoint, {
              method: "GET",
              headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${config.OpenAI_API_Key}`
              },
              body: JSON.stringify({
                  model: "gpt-4o-mini",
                  messages: [{ role: "user", content: fullprompt }],
                  max_tokens: 50
              })
          });

            res.status(200).json({ status: "report success" });
        } catch (error) {
            console.error("Error saving to Google Sheets:", error);
            res.status(500).json({ status: "google sheets error", error: error.message });
        }
    }

})

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})