-- Drop tables if they already exist
DROP TABLE IF EXISTS Chats;
DROP TABLE IF EXISTS Users;

-- Create Users table
CREATE TABLE IF NOT EXISTS Users (
  userId TEXT PRIMARY KEY,
  email TEXT UNIQUE,  -- no NOT NULL now, so optional
  name TEXT           -- no NOT NULL now, so optional
);

-- Create Chats table
CREATE TABLE IF NOT EXISTS Chats (
  chatId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  title TEXT,
  createdTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES Users(userId)
);
