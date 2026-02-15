const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use Render's persistent disk if available, otherwise use local directory
const DB_DIR = process.env.RENDER_DISK_MOUNT_PATH 
  ? path.join('/data', 'database')
  : path.join(__dirname, '../database');

// Create database directory if it doesn't exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'mdrg.db');
console.log('Database path:', DB_PATH);

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Initialize tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Clients table
      db.run(`
        CREATE TABLE IF NOT EXISTS clients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          company_name TEXT,
          phone TEXT,
          address TEXT,
          city TEXT,
          postcode TEXT,
          country TEXT DEFAULT 'UK',
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        )
      `);

      // Debts/Cases table
      db.run(`
        CREATE TABLE IF NOT EXISTS cases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id TEXT UNIQUE NOT NULL,
          client_id TEXT NOT NULL,
          debtor_name TEXT NOT NULL,
          debtor_company TEXT,
          debtor_email TEXT,
          debtor_phone TEXT,
          debtor_address TEXT,
          amount_owed REAL NOT NULL,
          currency TEXT DEFAULT 'GBP',
          debt_type TEXT,
          description TEXT,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'medium',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          assigned_to TEXT,
          notes TEXT,
          FOREIGN KEY (client_id) REFERENCES clients(client_id)
        )
      `);

      // Payments table
      db.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          payment_id TEXT UNIQUE NOT NULL,
          case_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          amount REAL NOT NULL,
          payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          payment_method TEXT,
          status TEXT DEFAULT 'completed',
          reference TEXT,
          notes TEXT,
          FOREIGN KEY (case_id) REFERENCES cases(case_id),
          FOREIGN KEY (client_id) REFERENCES clients(client_id)
        )
      `);

      // Activity log table
      db.run(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          user_type TEXT DEFAULT 'client',
          action TEXT NOT NULL,
          details TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database tables initialized successfully.');
          resolve();
        }
      });
    });
  });
};

// Helper functions for database operations
const dbQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

module.exports = {
  db,
  initDatabase,
  dbQuery,
  dbRun,
  dbGet
};
