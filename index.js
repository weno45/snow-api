const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Render automatycznie pobierze te dane z zakładki Environment Variables!
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Endpoint wyszukiwania
app.get('/search', async (req, res) => {
    const { nick } = req.query;
    
    if (!nick) {
        return res.status(400).json({ error: 'Brak parametru "nick" w zapytaniu' });
    }
    
    try {
        // Wyszukiwanie w bazie Turso bez względu na wielkość liter
        const result = await db.execute({
            sql: "SELECT nickname, ip FROM leaks WHERE LOWER(nickname) = LOWER(?)",
            args: [nick]
        });
        
        if (result.rows.length > 0) {
            const responseText = result.rows.map(row => `${row.nickname} ${row.ip}`).join('\n');
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.send(responseText);
        } else {
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.send('nie znaleziono gracza');
        }
    } catch (error) {
        console.error('Błąd bazy danych:', error);
        return res.status(500).json({ error: 'Błąd podczas wyszukiwania w bazie danych' });
    }
});

// Strona główna
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        database: 'Turso DB Connected',
        message: 'Snow Finder API'
    });
});

app.listen(PORT, () => {
    console.log(`Serwer wystartował na porcie ${PORT}`);
});
