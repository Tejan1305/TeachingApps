import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
    try {
        const { documentText, grade, subject, assessmentType, topic, learningObjectives, difficulty, numQuestions } = await req.json();

        if (!documentText) {
            return NextResponse.json({ success: false, error: "Document text is required" }, { status: 400 });
        }

        if (!GROQ_API_KEY || !OPENAI_API_KEY) {
            return NextResponse.json({ success: false, error: "Missing API keys" }, { status: 500 });
        }

        // Chunking and vectorization
        const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
        const chunks = await textSplitter.splitText(documentText);
        const embeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });
        const vectorStore = new MemoryVectorStore(embeddings);
        await vectorStore.addDocuments(chunks.map(chunk => ({ pageContent: chunk, metadata: {} })));

        // Retrieve relevant content
        const query = topic || learningObjectives || subject;
        const relevantDocs = await vectorStore.similaritySearch(query, 5);
        const relevantChunks = relevantDocs.map(doc => doc.pageContent).join(' ');

        // Generate questions using Groq AI
        const groq = new Groq({ apiKey: GROQ_API_KEY });
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are an expert assessment generator. Based on the following document content, create ${numQuestions} ${assessmentType} questions.
                    - Grade: ${grade}
                    - Subject: ${subject}
                    - Topic: ${topic}
                    - Difficulty Level: ${difficulty}
                    - Learning Objectives: ${learningObjectives}
                    - Document Excerpt: "${relevantChunks}"

                    Please ensure the questions are clear, well-structured, and align with the topic.`,
                },
            ],
        });

        if (!response.choices || response.choices.length === 0) {
            return NextResponse.json({ success: false, error: "No valid response from Groq API" }, { status: 500 });
        }

        const questions = response.choices[0]?.message?.content?.split("\n").filter(q => q.trim() !== "") || [];

        return NextResponse.json({ success: true, questions });

    } catch (error) {
        console.error("Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}