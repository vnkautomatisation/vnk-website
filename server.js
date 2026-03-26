const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Route de test
app.get('/api/health', (req, res) => {
    res.json({
        status: 'VNK Automatisation Inc. — Serveur opérationnel',
        version: '1.0.0',
        date: new Date().toISOString()
    });
});

// Route principale
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});


// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`VNK Automatisation Inc.`);
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
    console.log(`Environnement: ${process.env.NODE_ENV}`);
});