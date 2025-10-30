import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import * as path from 'path';
import cors from 'cors';
import { GoogleSheetService } from './googleSheet';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Validate environment variables
const requiredEnvVars = ['GOOGLE_SHEET_ID', 'GOOGLE_CREDENTIALS_PATH', 'GROUP_NAMES'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} is not set in .env file`);
    process.exit(1);
  }
}

// Initialize Google Sheet Service
const googleSheetService = new GoogleSheetService(
  process.env.GOOGLE_CREDENTIALS_PATH!,
  process.env.GOOGLE_SHEET_ID!,
  parseInt(process.env.MAX_STUDENTS_PER_GROUP || '5')
);

// Parse group names from environment variable
const GROUP_NAMES = process.env.GROUP_NAMES!.split(',').map(name => name.trim());

// Initialize sheet on startup
(async () => {
  try {
    await googleSheetService.initializeSheet();
    console.log('Google Sheet initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Google Sheet:', error);
    process.exit(1);
  }
})();

// API Routes

/**
 * GET /api/groups
 * Get all groups with their current status
 */
app.get('/api/groups', async (req: Request, res: Response) => {
  try {
    const groupCounts = await googleSheetService.getGroupCounts();
    const maxStudents = parseInt(process.env.MAX_STUDENTS_PER_GROUP || '5');

    const groups = GROUP_NAMES.map(groupName => ({
      name: groupName,
      count: groupCounts[groupName] || 0,
      isFull: (groupCounts[groupName] || 0) >= maxStudents,
      maxStudents: maxStudents
    }));

    res.json({ success: true, groups });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group information'
    });
  }
});

/**
 * GET /api/students
 * Get all registered students
 */
app.get('/api/students', async (req: Request, res: Response) => {
  try {
    const students = await googleSheetService.getAllStudents();
    res.json({ success: true, students });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students'
    });
  }
});

/**
 * POST /api/register
 * Register a new student
 */
app.post('/api/register', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, school, group } = req.body;

    // Validation
    if (!name || !email || !phone || !school || !group) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate phone format (Vietnamese phone numbers)
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Check if group exists
    if (!GROUP_NAMES.includes(group)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group selection'
      });
    }

    // Check if group is full
    const isGroupFull = await googleSheetService.isGroupFull(group);
    if (isGroupFull) {
      return res.status(400).json({
        success: false,
        message: 'This group is already full. Please select another group.'
      });
    }

    // Add student to Google Sheet
    await googleSheetService.addStudent({
      name,
      email,
      phone,
      school,
      group
    });

    res.json({
      success: true,
      message: 'Registration successful!'
    });
  } catch (error) {
    console.error('Error registering student:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register student. Please try again.'
    });
  }
});

/**
 * GET /
 * Serve the main HTML page
 */
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Groups: ${GROUP_NAMES.join(', ')}`);
});
