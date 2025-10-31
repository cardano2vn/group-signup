import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

interface Student {
  name: string;
  email: string;
  phone: string;
  school: string;
  group: string;
}

interface GroupCount {
  [key: string]: number;
}

export class GoogleSheetService {
  private sheets;
  private spreadsheetId: string;
  private maxStudentsPerGroup: number;

  constructor(credentialsPath: string, spreadsheetId: string, maxStudentsPerGroup: number = 5) {
    this.spreadsheetId = spreadsheetId;
    this.maxStudentsPerGroup = maxStudentsPerGroup;

    // Load credentials from JSON file
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

    // Create JWT client for authentication
    const auth = new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * Initialize the spreadsheet with headers if not exists
   */
  async initializeSheet(): Promise<void> {
    try {
      console.log(`Attempting to access spreadsheet: ${this.spreadsheetId}`);

      // Check if sheet has headers
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A1:E1',
      });

      console.log('Successfully connected to Google Sheet');

      // If no data, add headers
      if (!response.data.values || response.data.values.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'Sheet1!A1:E1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Họ và tên', 'Email', 'Số điện thoại', 'Trường học', 'Nhóm']],
          },
        });
        console.log('Headers initialized in Google Sheet');
      } else {
        console.log('Headers already exist in Google Sheet');
      }
    } catch (error: any) {
      console.error('Error initializing sheet:');
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error details:', error.errors);
      console.error('Full error:', JSON.stringify(error, null, 2));

      if (error.code === 403) {
        console.error('\n⚠️  PERMISSION DENIED: The service account does not have access to the spreadsheet.');
        console.error(`    Please share the spreadsheet with: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'the service account'}`);
      } else if (error.code === 404) {
        console.error('\n⚠️  SPREADSHEET NOT FOUND: Check if the GOOGLE_SHEET_ID is correct.');
      }

      throw new Error(`Failed to initialize Google Sheet: ${error.message}`);
    }
  }

  /**
   * Add a student to the Google Sheet
   */
  async addStudent(student: Student): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:E',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            student.name,
            student.email,
            student.phone,
            student.school,
            student.group
          ]],
        },
      });
      console.log(`Student ${student.name} added to group ${student.group}`);
    } catch (error) {
      console.error('Error adding student:', error);
      throw new Error('Failed to add student to Google Sheet');
    }
  }

  /**
   * Get all students from the sheet
   */
  async getAllStudents(): Promise<Student[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A2:E', // Skip header row
      });

      const rows = response.data.values || [];
      return rows.map(row => ({
        name: row[0] || '',
        email: row[1] || '',
        phone: row[2] || '',
        school: row[3] || '',
        group: row[4] || '',
      }));
    } catch (error) {
      console.error('Error getting students:', error);
      throw new Error('Failed to get students from Google Sheet');
    }
  }

  /**
   * Get count of students in each group
   */
  async getGroupCounts(): Promise<GroupCount> {
    try {
      const students = await this.getAllStudents();
      const counts: GroupCount = {};

      students.forEach(student => {
        if (student.group) {
          counts[student.group] = (counts[student.group] || 0) + 1;
        }
      });

      return counts;
    } catch (error) {
      console.error('Error getting group counts:', error);
      throw new Error('Failed to get group counts');
    }
  }

  /**
   * Get available groups (groups that are not full)
   */
  async getAvailableGroups(allGroups: string[]): Promise<string[]> {
    try {
      const counts = await this.getGroupCounts();
      return allGroups.filter(group =>
        (counts[group] || 0) < this.maxStudentsPerGroup
      );
    } catch (error) {
      console.error('Error getting available groups:', error);
      throw new Error('Failed to get available groups');
    }
  }

  /**
   * Check if a group is full
   */
  async isGroupFull(groupName: string): Promise<boolean> {
    try {
      const counts = await this.getGroupCounts();
      return (counts[groupName] || 0) >= this.maxStudentsPerGroup;
    } catch (error) {
      console.error('Error checking if group is full:', error);
      throw new Error('Failed to check group status');
    }
  }

  /**
   * Check if email or phone number already exists in the sheet
   */
  async checkDuplicate(email: string, phone: string): Promise<{ isDuplicate: boolean; field?: string }> {
    try {
      const students = await this.getAllStudents();

      // Normalize phone number for comparison (remove spaces and dashes)
      const normalizedPhone = phone.replace(/[\s-]/g, '');

      // Check for duplicate email
      const emailExists = students.some(student =>
        student.email.toLowerCase() === email.toLowerCase()
      );

      if (emailExists) {
        return { isDuplicate: true, field: 'email' };
      }

      // Check for duplicate phone
      const phoneExists = students.some(student =>
        student.phone.replace(/[\s-]/g, '') === normalizedPhone
      );

      if (phoneExists) {
        return { isDuplicate: true, field: 'phone' };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      throw new Error('Failed to check for duplicate records');
    }
  }
}
