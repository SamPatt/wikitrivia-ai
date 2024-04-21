require('dotenv').config();

const Groq = require('groq-sdk');
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function main(content) {
    try {
        const chatCompletion = await getGroqChatCompletion(content);
        console.log(chatCompletion.choices[0].message);
    } catch (error) {
        console.error('Error calling Groq API:', error);
    }
}

async function getGroqChatCompletion(content) {
    return groq.chat.completions.create({
        messages: [{
            role: "user",
            content: content
        }],
        model: "llama3-8b-8192"
    });
}

// Example usage:
main("Explain the importance of fast language models").catch(console.error);
