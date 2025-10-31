import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import * as path from 'path';
import cors from 'cors';
import * as https from 'https';
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

// Initialize sheet on startup (non-blocking for serverless)
let isSheetInitialized = false;
const initPromise = (async () => {
  try {
    await googleSheetService.initializeSheet();
    console.log('Google Sheet initialized successfully');
    isSheetInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Google Sheet:', error);
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
})();

// Middleware to ensure sheet is initialized before handling requests
app.use(async (req, res, next) => {
  if (!isSheetInitialized) {
    try {
      await initPromise;
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable - Google Sheets initialization failed'
      });
    }
  }
  next();
});

// Helper function to verify reCAPTCHA
async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY is not set');
    return false;
  }

  return new Promise((resolve) => {
    const postData = `secret=${secretKey}&response=${token}`;

    const options = {
      hostname: 'www.google.com',
      port: 443,
      path: '/recaptcha/api/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.success === true);
        } catch (error) {
          console.error('Error parsing reCAPTCHA response:', error);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error verifying reCAPTCHA:', error);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

// API Routes

/**
 * GET /api/config
 * Get public configuration (e.g., reCAPTCHA site key)
 */
app.get('/api/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ''
  });
});

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
    const { name, email, phone, school, group, recaptchaToken } = req.body;

    // Validation
    if (!name || !email || !phone || !school || !group) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Verify reCAPTCHA
    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification is required'
      });
    }

    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification failed. Please try again.'
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

    // Check for duplicate email or phone number
    const duplicateCheck = await googleSheetService.checkDuplicate(email, phone);
    if (duplicateCheck.isDuplicate) {
      const fieldName = duplicateCheck.field === 'email' ? 'Email' : 'Phone number';
      return res.status(400).json({
        success: false,
        message: `${fieldName} already exists. Please use a different ${duplicateCheck.field}.`
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

// Start server (only for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Groups: ${GROUP_NAMES.join(', ')}`);
  });
}

// Export the Express app for Vercel
export default app;
