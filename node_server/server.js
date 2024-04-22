require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Groq = require('groq-sdk');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

app.use(bodyParser.json());

app.use(cors());

app.post('/groq-chat', async (req, res) => {
    const { content } = req.body;
    //console.log(content);
    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        const chatCompletion = await getGroqChatCompletion(content);
        console.log(chatCompletion.choices[0].message);
        res.json(chatCompletion.choices[0].message);
    } catch (error) {
        console.error('Error calling Groq API:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

async function getGroqChatCompletion(content) {
    return groq.chat.completions.create({
        messages: [{ role: "user", content }],
        model: "llama3-8b-8192"
    });
}

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
