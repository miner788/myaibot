require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// MONGODB CONNECTION
// ==========================================
// Add your MongoDB URI to a .env file: MONGODB_URI=mongodb+srv://...
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/universal-ai-chat';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ==========================================
// DATABASE SCHEMAS (Mongoose Models)
// ==========================================

// 1. User Settings Schema
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // Simple ID for now (e.g., 'default-user')
  apiKey: { type: String, default: '' }, // NOTE: In production, encrypt this!
  model: { type: String, default: 'deepseek/deepseek-r1:free' },
  systemPrompt: { type: String, default: 'You are a helpful, harmless, and honest AI assistant.' },
  darkMode: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// 2. Chat & Messages Schema
const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Links chat to a specific user
  title: { type: String, default: 'New Chat' },
  messages: [messageSchema] // Embeds messages directly into the chat document
}, { timestamps: true });

const Chat = mongoose.model('Chat', chatSchema);

// ==========================================
// API ROUTES
// ==========================================

// --- SETTINGS ROUTES ---

// Get user settings
app.get('/api/settings/:userId', async (req, res) => {
  try {
    let settings = await User.findOne({ userId: req.params.userId });
    if (!settings) {
      settings = await User.create({ userId: req.params.userId });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user settings
app.post('/api/settings/:userId', async (req, res) => {
  try {
    const settings = await User.findOneAndUpdate(
      { userId: req.params.userId },
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CHAT ROUTES ---

// Get all chats for a user (without full message history to save bandwidth)
app.get('/api/chats/:userId', async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.params.userId })
      .select('_id title updatedAt')
      .sort({ updatedAt: -1 }); // Newest first
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single chat with full message history
app.get('/api/chats/:userId/:chatId', async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.params.userId });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new chat
app.post('/api/chats/:userId', async (req, res) => {
  try {
    const newChat = await Chat.create({
      userId: req.params.userId,
      title: req.body.title || 'New Chat',
      messages: []
    });
    res.status(201).json(newChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update chat (e.g., append messages or rename)
app.put('/api/chats/:userId/:chatId', async (req, res) => {
  try {
    const { title, messages } = req.body;
    const updateData = {};
    if (title) updateData.title = title;
    if (messages) updateData.messages = messages; // Replaces entire message array

    const updatedChat = await Chat.findOneAndUpdate(
      { _id: req.params.chatId, userId: req.params.userId },
      { $set: updateData },
      { new: true }
    );
    res.json(updatedChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a chat
app.delete('/api/chats/:userId/:chatId', async (req, res) => {
  try {
    await Chat.findOneAndDelete({ _id: req.params.chatId, userId: req.params.userId });
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
