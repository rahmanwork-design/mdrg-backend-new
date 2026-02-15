const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbQuery, dbGet, dbRun } = require('../src/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all clients (admin only - would need admin middleware in production)
router.get('/', async (req, res) => {
  try {
    const clients = await dbQuery(
      `SELECT client_id, email, first_name, last_name, company_name, phone, 
              status, created_at, last_login 
       FROM clients ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      count: clients.length,
      data: clients
    });

  } catch (error) {
    console.error('Fetch clients error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching clients.',
      error: error.message
    });
  }
});

// Get client by ID
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await dbGet(
      `SELECT client_id, email, first_name, last_name, company_name, phone, 
              address, city, postcode, country, status, created_at, last_login 
       FROM clients WHERE client_id = ?`,
      [clientId]
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found.'
      });
    }

    res.json({
      success: true,
      data: client
    });

  } catch (error) {
    console.error('Fetch client error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching client.',
      error: error.message
    });
  }
});

// Get client's cases
router.get('/:clientId/cases', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;

    // Verify the requesting user owns these cases
    if (req.user.client_id !== clientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own cases.'
      });
    }

    const cases = await dbQuery(
      `SELECT case_id, debtor_name, debtor_company, amount_owed, currency, 
              debt_type, status, priority, created_at, updated_at, notes
       FROM cases WHERE client_id = ? ORDER BY created_at DESC`,
      [clientId]
    );

    res.json({
      success: true,
      count: cases.length,
      data: cases
    });

  } catch (error) {
    console.error('Fetch cases error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching cases.',
      error: error.message
    });
  }
});

// Create new case
router.post('/:clientId/cases', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;

    // Verify the requesting user owns this account
    if (req.user.client_id !== clientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    const {
      debtor_name,
      debtor_company,
      debtor_email,
      debtor_phone,
      debtor_address,
      amount_owed,
      currency,
      debt_type,
      description,
      priority
    } = req.body;

    // Validation
    if (!debtor_name || !amount_owed) {
      return res.status(400).json({
        success: false,
        message: 'Debtor name and amount owed are required.'
      });
    }

    // Generate case ID
    const caseId = 'CASE' + Date.now().toString(36).toUpperCase();

    await dbRun(
      `INSERT INTO cases (case_id, client_id, debtor_name, debtor_company, debtor_email, 
                          debtor_phone, debtor_address, amount_owed, currency, debt_type, 
                          description, priority, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [caseId, clientId, debtor_name, debtor_company, debtor_email, debtor_phone,
       debtor_address, amount_owed, currency || 'GBP', debt_type, description, priority || 'medium', '']
    );

    res.status(201).json({
      success: true,
      message: 'Case created successfully.',
      data: { case_id: caseId }
    });

  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating case.',
      error: error.message
    });
  }
});

// Get case details
router.get('/:clientId/cases/:caseId', authenticateToken, async (req, res) => {
  try {
    const { clientId, caseId } = req.params;

    if (req.user.client_id !== clientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    const caseData = await dbGet(
      `SELECT * FROM cases WHERE case_id = ? AND client_id = ?`,
      [caseId, clientId]
    );

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found.'
      });
    }

    // Get payments for this case
    const payments = await dbQuery(
      `SELECT payment_id, amount, payment_date, payment_method, status, reference
       FROM payments WHERE case_id = ? ORDER BY payment_date DESC`,
      [caseId]
    );

    res.json({
      success: true,
      data: {
        ...caseData,
        payments
      }
    });

  } catch (error) {
    console.error('Fetch case error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching case.',
      error: error.message
    });
  }
});

// Update client status (activate/deactivate)
router.patch('/:clientId/status', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, inactive, or suspended.'
      });
    }

    await dbRun(
      'UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?',
      [status, clientId]
    );

    res.json({
      success: true,
      message: `Client status updated to ${status}.`
    });

  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating status.',
      error: error.message
    });
  }
});

// Get client statistics
router.get('/:clientId/stats', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;

    if (req.user.client_id !== clientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    // Get case counts by status
    const caseStats = await dbGet(
      `SELECT 
        COUNT(*) as total_cases,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_cases,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as active_cases,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_cases,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_cases,
        SUM(amount_owed) as total_amount_owed
       FROM cases WHERE client_id = ?`,
      [clientId]
    );

    // Get total payments received
    const paymentStats = await dbGet(
      `SELECT 
        COUNT(*) as total_payments,
        SUM(amount) as total_collected
       FROM payments WHERE client_id = ? AND status = 'completed'`,
      [clientId]
    );

    res.json({
      success: true,
      data: {
        cases: caseStats,
        payments: paymentStats
      }
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching statistics.',
      error: error.message
    });
  }
});

module.exports = router;
