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

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})