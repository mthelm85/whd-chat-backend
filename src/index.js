import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { executeQuery, getPool } from "./db.js";
import { tools } from "./tools.js";

const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const allowedOrigins = [
  'http://localhost:5173',
  'https://white-bush-0aadc791e.6.azurestaticapps.net'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Test connection on startup
getPool()
    .then(() => console.log("✅ Database connected successfully"))
    .catch((err) =>
        console.error("❌ Database connection failed:", err.message)
    );

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// Streaming chat endpoint
app.post("/api/chat", async (req, res) => {
    try {
        const { messages } = req.body;

        // Set up SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        let currentMessages = messages;
        let iterations = 0;
        const maxIterations = 10;

        while (iterations < maxIterations) {
            iterations++;

            // Stream response from Claude
            const stream = anthropic.messages.stream({
                model: "claude-sonnet-4-5-20250929",
                max_tokens: 4096,
                messages: currentMessages,
                tools: tools,
            });

            // Handle stream events
            stream.on("text", (text) => {
                // Send text chunks as they arrive
                res.write(
                    `data: ${JSON.stringify({
                        type: "text",
                        content: text,
                    })}\n\n`
                );
            });

            stream.on("error", (error) => {
                console.error("Stream error:", error);
                res.write(
                    `data: ${JSON.stringify({
                        type: "error",
                        message: error.message,
                    })}\n\n`
                );
                res.end();
            });

            // Wait for stream to complete
            const message = await stream.finalMessage();

            // Check if Claude wants to use a tool
            const toolUse = message.content.find(
                (block) => block.type === "tool_use"
            );

            if (toolUse) {
                // Send status update to user
                res.write(
                    `data: ${JSON.stringify({
                        type: "status",
                        message: `Executing ${toolUse.name}...`,
                    })}\n\n`
                );

                let toolResult;

                if (toolUse.name === "execute_sql") {
                    console.log("Executing query:", toolUse.input.query);

                    // Security check - only allow SELECT
                    if (
                        !toolUse.input.query
                            .trim()
                            .toUpperCase()
                            .startsWith("SELECT")
                    ) {
                        toolResult = {
                            error: "Only SELECT queries are allowed",
                        };
                    } else {
                        try {
                            const data = await executeQuery(
                                toolUse.input.query
                            );

                            // Limit results to prevent token overflow
                            const MAX_ROWS = 100;
                            const limitedData = data.slice(0, MAX_ROWS);

                            // Calculate approximate size and truncate if needed
                            const resultString = JSON.stringify(limitedData);
                            const MAX_CHARS = 50000; // ~10k tokens

                            if (resultString.length > MAX_CHARS) {
                                toolResult = {
                                    rows: limitedData.slice(0, 20), // Even more aggressive limit
                                    count: data.length,
                                    truncated: true,
                                    message: `Results truncated. Showing first 20 of ${data.length} rows.`,
                                };
                            } else if (data.length > MAX_ROWS) {
                                toolResult = {
                                    rows: limitedData,
                                    count: data.length,
                                    truncated: true,
                                    message: `Results limited. Showing first ${MAX_ROWS} of ${data.length} rows.`,
                                };
                            } else {
                                toolResult = { rows: data, count: data.length };
                            }
                        } catch (err) {
                            console.error("Query error:", err);
                            toolResult = { error: err.message };
                        }
                    }
                }

                // Add assistant's tool use and tool result to conversation
                currentMessages.push({
                    role: "assistant",
                    content: message.content,
                });

                currentMessages.push({
                    role: "user",
                    content: [
                        {
                            type: "tool_result",
                            tool_use_id: toolUse.id,
                            content: JSON.stringify(toolResult),
                        },
                    ],
                });

                // Continue loop to get Claude's response with the data
            } else {
                // Claude is done - send completion event
                res.write(
                    `data: ${JSON.stringify({
                        type: "done",
                        usage: message.usage,
                    })}\n\n`
                );
                res.end();
                return;
            }
        }

        // Max iterations reached
        res.write(
            `data: ${JSON.stringify({
                type: "error",
                message: "Max iterations reached",
            })}\n\n`
        );
        res.end();
    } catch (err) {
        console.error("Chat error:", err);
        res.write(
            `data: ${JSON.stringify({
                type: "error",
                message: err.message,
            })}\n\n`
        );
        res.end();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
