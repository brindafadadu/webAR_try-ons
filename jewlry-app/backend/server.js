const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const {exec} = require('child_process');

const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
const earringsRoutes = require('./routes/earringRoutes');  


const app = express();
const PORT = process.env.PORT || 3000;


mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/images/uploads', express.static(path.join(__dirname, 'public', 'images', 'uploads')));
app.use('/images/processed', express.static(path.join(__dirname, 'public', 'images', 'processed')));

//using earring routes
app.use(earringsRoutes);

// Default route to serve index2.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'../frontend', 'index2.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
