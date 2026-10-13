const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ścieżka do folderu z danymi
const LEAKS_FOLDER = path.join(__dirname, 'leaks');

// Funkcja wyciągająca nick i IP z pojedynczej linii
function extractNickAndIP(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return null;
    
    // FORMAT 1: Prosty format "nickname IP:port" lub "nickname IP"
    if (!trimmedLine.includes('"')) {
        const parts = trimmedLine.split(/\s+/);
        if (parts.length >= 2) {
            const nickname = parts[0];
            const ip = parts[1];
            return { nickname, ip };
        }
    }
    
    // FORMAT 2: Złożony format z cudzysłowami i tabulatorami
    if (trimmedLine.includes('"')) {
        try {
            const sections = trimmedLine.split('\t');
            if (sections.length >= 2) {
                const firstSection = sections[0].trim();
                if (firstSection.startsWith('"') && firstSection.endsWith('"')) {
                    const innerFirst = firstSection.slice(1, -1);
                    const firstParts = innerFirst.split('\t');
                    if (firstParts.length > 0) {
                        const nickname = firstParts[0];
                        const secondSection = sections[sections.length - 1].trim();
                        if (secondSection.startsWith('"') && secondSection.endsWith('"')) {
                            const innerSecond = secondSection.slice(1, -1);
                            const secondParts = innerSecond.split('\t');
                            if (secondParts.length >= 2) {
                                const ip = secondParts[secondParts.length - 1];
                                return { nickname, ip };
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Błąd podczas parsowania złożonego formatu:', error);
        }
    }
    
    // FORMAT 3: Wyszukiwanie poprzez Wyrażenia Regularne (Regex)
    const nicknameMatch = trimmedLine.match(/^"?(?:\\"|.)*?\b([a-zA-Z0-9_]+)\b/);
    const ipMatch = trimmedLine.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?)\b/);
    
    if (nicknameMatch && ipMatch) {
        return { nickname: nicknameMatch[1], ip: ipMatch[1] };
    }
    
    return null;
}

// Funkcja przeszukująca pliki TXT
async function searchForNickname(nickname) {
    const results = [];
    
    try {
        // Sprawdzenie, czy folder istnieje na serwerze
        if (!fs.existsSync(LEAKS_FOLDER)) {
            console.warn('Folder "leaks" nie istnieje na serwerze.');
            return results;
        }

        const files = fs.readdirSync(LEAKS_FOLDER);
        const txtFiles = files.filter(file => file.endsWith('.txt'));
        
        for (const file of txtFiles) {
            const filePath = path.join(LEAKS_FOLDER, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            for (const line of lines) {
                const extracted = extractNickAndIP(line);
                if (extracted) {
                    const { nickname: fileNickname, ip } = extracted;
                    if (fileNickname.toLowerCase() === nickname.toLowerCase()) {
                        results.push(`${fileNickname} ${ip}`);
                    }
                }
            }
        }
        
        return results;
    } catch (error) {
        console.error('Błąd podczas przeszukiwania plików:', error);
        throw error;
    }
}

// Endpoint wyszukiwania (dodano async/await)
app.get('/search', async (req, res) => {
    const { nick } = req.query;
    
    if (!nick) {
        return res.status(400).json({
            error: 'Brak parametru "nick" w zapytaniu'
        });
    }
    
    try {
        const results = await searchForNickname(nick);
        
        if (results.length > 0) {
            const responseText = results.join('\n');
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.send(responseText);
        } else {
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.send('nie znaleziono gracza');
        }
    } catch (error) {
        console.error('Błąd podczas przetwarzania zapytania:', error);
        return res.status(500).json({
            error: 'Wystąpił błąd podczas wyszukiwania'
        });
    }
});

// Strona główna (Health check)
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'Snow Finder API',
        endpoints: {
            search: '/search?nick=nazwa_gracza'
        }
    });
});

// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`Snow Finder API uruchomiony na porcie ${PORT}`);
});

module.exports = {
    app,
    extractNickAndIP,
    searchForNickname
};
