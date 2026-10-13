const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Path to the leaks folder
const LEAKS_FOLDER = path.join(__dirname, 'leaks');

// Function to extract nickname and IP from a line
function extractNickAndIP(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return null;
    
    // Try different parsing strategies based on format
    
    // FORMAT 1: Simple format: "nickname IP:port" or "nickname IP"
    if (!trimmedLine.includes('"')) {
        const parts = trimmedLine.split(/\s+/);
        if (parts.length >= 2) {
            const nickname = parts[0];
            const ip = parts[1];
            return { nickname, ip };
        }
    }
    
    // FORMAT 2: Complex format with quotes and tabs: "nickname\trole\tdate"\t" hour\tIP"
    if (trimmedLine.includes('"')) {
        try {
            // Split by tab to get the two quoted sections
            const sections = trimmedLine.split('\t');
            if (sections.length >= 2) {
                // First section: "nickname\trole\tdate"
                const firstSection = sections[0].trim();
                if (firstSection.startsWith('"') && firstSection.endsWith('"')) {
                    const innerFirst = firstSection.slice(1, -1);
                    const firstParts = innerFirst.split('\t');
                    if (firstParts.length > 0) {
                        const nickname = firstParts[0];
                        
                        // Second section: " hour\tIP"
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
            console.warn('Error parsing complex format:', error);
        }
    }
    
    // FORMAT 3: Alternative approach - extract using regex
    // Try to find nickname (word without spaces at start) and IP (numbers with dots)
    const nicknameMatch = trimmedLine.match(/^"?(?:\\"|.)*?\b([a-zA-Z0-9_]+)\b/);
    const ipMatch = trimmedLine.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?)\b/);
    
    if (nicknameMatch && ipMatch) {
        return { nickname: nicknameMatch[1], ip: ipMatch[1] };
    }
    
    return null;
}

// Helper function to read all TXT files and search for nicknames
async function searchForNickname(nickname) {
    const results = [];
    
    try {
        // Read all files in the leaks folder
        const files = fs.readdirSync(LEAKS_FOLDER);
        
        // Filter for .txt files
        const txtFiles = files.filter(file => file.endsWith('.txt'));
        
        // Search through each file
        for (const file of txtFiles) {
            const filePath = path.join(LEAKS_FOLDER, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Search each line for the nickname
            for (const line of lines) {
                const extracted = extractNickAndIP(line);
                if (extracted) {
                    const { nickname: fileNickname, ip } = extracted;
                    
                    // Check if nickname matches (case insensitive)
                    if (fileNickname.toLowerCase() === nickname.toLowerCase()) {
                        results.push(`${fileNickname} ${ip}`);
                    }
                }
            }
        }
        
        return results;
    } catch (error) {
        console.error('Error searching for nickname:', error);
        throw error;
    }
}

// API endpoint for searching nicknames
app.get('/search', (req, res) => {
    const { nick } = req.query;
    
    if (!nick) {
        return res.status(400).json({
            error: 'Brak parametru "nick" w zapytaniu'
        });
    }
    
    try {
        const results = searchForNickname(nick);
        
        if (results.length > 0) {
            // Format response as plain text with each match on new line
            const responseText = results.join('\n');
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.send(responseText);
        } else {
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.send('nie znaleziono gracza');
        }
    } catch (error) {
        console.error('Error processing search:', error);
        return res.status(500).json({
            error: 'Wystąpił błąd podczas wyszukiwania'
        });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Snow Finder API',
        endpoints: {
            search: '/search?nick=nazwa_gracza'
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Snow Finder API uruchomiony na porcie ${PORT}`);
    console.log(`Endpoint wyszukiwania: http://localhost:${PORT}/search?nick=nazwa_gracza`);
});

module.exports = {
    app,
    extractNickAndIP,
    searchForNickname
};