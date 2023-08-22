const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Question = require('./model/questions');
const User = require('./model/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

app.use(express.json());

const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://<id>:<password>@cluster0.jz6lcpo.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB database');
});


//
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({ username, email, password: hashedPassword });
        await user.save();

        // Generate a JWT token
        const token = jwt.sign({ userId: user._id }, 'your_secret_key', { expiresIn: '1h' });

        res.status(201).json({ message: 'User registered successfully', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});


const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ message: 'Token missing' });
    }

    jwt.verify(token, 'your_secret_key', (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        req.userId = decoded.userId;
        next();
    });
};

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: 'Authentication failed' });
        }

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Authentication failed' });
        }

        // Generate a JWT token
        const token = jwt.sign({ userId: user._id }, 'your_secret_key', { expiresIn: '1h' });

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.post('/api/questions', verifyToken, async (req, res) => {
    try {
        const { title, content } = req.body;
        const userId = req.userId; // User ID from JWT payload

        const question = new Question({ title, content, user: userId });
        await question.save();

        res.status(201).json(question);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.put('/api/questions/:questionId', verifyToken, async (req, res) => {
    try {
        const { title, content } = req.body;
        const userId = req.userId; // User ID from JWT payload
        const questionId = req.params.questionId;

        const question = await Question.findOne({ _id: questionId, user: userId });

        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }

        question.title = title;
        question.content = content;
        await question.save();

        res.json(question);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.delete('/api/questions/:questionId', verifyToken, async (req, res) => {
    try {
        const userId = req.userId; // User ID from JWT payload
        const questionId = req.params.questionId;

        const query = { _id: questionId, user: userId };
        const deletedQuestion = await Question.findOneAndDelete(query);

        if (!deletedQuestion) {
            return res.status(404).json({ message: 'Question not found' });
        }

        res.json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find();
        res.json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.post('/api/questions/:questionId/comments', verifyToken, async (req, res) => {
    try {
      const userId = req.userId;
      const questionId = req.params.questionId;
      const { content } = req.body;
  
      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ message: 'Invalid question ID format' });
      }
  
      const question = await Question.findById(questionId);
  
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }
  
      const newComment = {
        content,
        user: userId,
      };
  
      question.comments.push(newComment);
      await question.save();
  
      res.json(question);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  });
  
  // Add a comment to an answer
  app.post('/api/answers/:answerId/comments', verifyToken, async (req, res) => {
    try {
      const userId = req.userId;
      const answerId = req.params.answerId;
      const { content } = req.body;
  
      if (!mongoose.Types.ObjectId.isValid(answerId)) {
        return res.status(400).json({ message: 'Invalid answer ID format' });
      }
  
      const answer = await Answer.findById(answerId);
  
      if (!answer) {
        return res.status(404).json({ message: 'Answer not found' });
      }
  
      const newComment = {
        content,
        user: userId,
      };
  
      answer.comments.push(newComment);
      await answer.save();
  
      res.json(answer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  });

  // Upvote a question
app.post('/api/questions/:questionId/upvote', verifyToken, async (req, res) => {
    try {
      const userId = req.userId;
      const questionId = req.params.questionId;
  
      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ message: 'Invalid question ID format' });
      }
  
      const question = await Question.findById(questionId);
  
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }
  
      if (question.upvotes.includes(userId)) {
        return res.status(400).json({ message: 'You have already upvoted this question' });
      }
  
      question.upvotes.push(userId);
      await question.save();
  
      res.json(question);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  });
  
  // Downvote a question
  app.post('/api/questions/:questionId/downvote', verifyToken, async (req, res) => {
    try {
      const userId = req.userId;
      const questionId = req.params.questionId;
  
      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ message: 'Invalid question ID format' });
      }
  
      const question = await Question.findById(questionId);
  
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }
  
      if (question.downvotes.includes(userId)) {
        return res.status(400).json({ message: 'You have already downvoted this question' });
      }
  
      question.downvotes.push(userId);
      await question.save();
  
      res.json(question);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  });
  
  // Upvote an answer
  app.post('/api/answers/:answerId/upvote', verifyToken, async (req, res) => {
    try {
      const userId = req.userId;
      const answerId = req.params.answerId;
  
      if (!mongoose.Types.ObjectId.isValid(answerId)) {
        return res.status(400).json({ message: 'Invalid answer ID format' });
      }
  
      const answer = await Answer.findById(answerId);
  
      if (!answer) {
        return res.status(404).json({ message: 'Answer not found' });
      }
  
      if (answer.upvotes.includes(userId)) {
        return res.status(400).json({ message: 'You have already upvoted this answer' });
      }
  
      answer.upvotes.push(userId);
      await answer.save();
  
      res.json(answer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  });
  
  // Downvote an answer
  app.post('/api/answers/:answerId/downvote', verifyToken, async (req, res) => {
    try {
      const userId = req.userId;
      const answerId = req.params.answerId;
  
      if (!mongoose.Types.ObjectId.isValid(answerId)) {
        return res.status(400).json({ message: 'Invalid answer ID format' });
      }
  
      const answer = await Answer.findById(answerId);
  
      if (!answer) {
        return res.status(404).json({ message: 'Answer not found' });
      }
  
      if (answer.downvotes.includes(userId)) {
        return res.status(400).json({ message: 'You have already downvoted this answer' });
      }
  
      answer.downvotes.push(userId);
      await answer.save();
  
      res.json(answer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred' });
    }
  });
  

// ... Implement other API endpoints similarly

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
