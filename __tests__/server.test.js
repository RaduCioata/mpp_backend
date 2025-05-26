const request = require('supertest');
const mysql = require('mysql');

// Mock MySQL
jest.mock('mysql', () => {
  const mockConnection = {
    query: jest.fn(),
    connect: jest.fn((callback) => callback(null))
  };
  return {
    createConnection: jest.fn(() => mockConnection)
  };
});

// Set test environment
process.env.NODE_ENV = 'test';

// Import app after setting test environment
const { app, setDbConnection } = require('../server');

describe('User API Tests', () => {
  let mockDb;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockDb = mysql.createConnection();
    setDbConnection(mockDb);
  });

  describe('Database Connection', () => {
    it('should handle database connection error', () => {
      // Save original environment
      const originalEnv = process.env.NODE_ENV;
      
      // Reset modules and set development environment
      jest.resetModules();
      process.env.NODE_ENV = 'development';
      
      // Mock console.error
      const mockError = new Error('Connection failed');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock MySQL with a failing connection
      jest.doMock('mysql', () => ({
        createConnection: jest.fn(() => ({
          connect: jest.fn((callback) => callback(mockError)),
          query: jest.fn()
        }))
      }));
      
      // Import server to trigger connection
      require('../server');
      
      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith('Database connection failed:', mockError);
      
      // Cleanup
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
      jest.resetModules();
      jest.unmock('mysql');
    });
  });

  describe('GET /users', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', type: 'user' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', type: 'admin' }
      ];

      mockDb.query.mockImplementation((query, params, callback) => {
        callback(null, mockUsers);
      });

      const response = await request(app).get('/users');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsers);
    });

    it('should handle database error', async () => {
      const mockError = new Error('Database error');
      mockDb.query.mockImplementation((query, params, callback) => {
        callback(mockError);
      });

      const response = await request(app).get('/users');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Server error' });
    });

    it('should filter users by name', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', type: 'user' }
      ];

      mockDb.query.mockImplementation((query, params, callback) => {
        expect(query).toContain('WHERE name LIKE ?');
        expect(params).toContain('%John%');
        callback(null, mockUsers);
      });

      const response = await request(app).get('/users?name=John');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsers);
    });

    it('should filter users by type', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', type: 'admin' }
      ];

      mockDb.query.mockImplementation((query, params, callback) => {
        expect(query).toContain('WHERE type = ?');
        expect(params).toContain('admin');
        callback(null, mockUsers);
      });

      const response = await request(app).get('/users?type=admin');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsers);
    });

    it('should filter users by email', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', type: 'user' }
      ];

      mockDb.query.mockImplementation((query, params, callback) => {
        expect(query).toContain('WHERE email LIKE ?');
        expect(params).toContain('%john%');
        callback(null, mockUsers);
      });

      const response = await request(app).get('/users?email=john');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsers);
    });

    it('should sort users by name', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', type: 'user' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', type: 'admin' }
      ];

      mockDb.query.mockImplementation((query, params, callback) => {
        expect(query).toContain('ORDER BY name ASC');
        callback(null, mockUsers);
      });

      const response = await request(app).get('/users?sort=name:asc');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsers);
    });

    it('should ignore invalid sort fields', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', type: 'user' }
      ];

      mockDb.query.mockImplementation((query, params, callback) => {
        expect(query).not.toContain('ORDER BY');
        callback(null, mockUsers);
      });

      const response = await request(app).get('/users?sort=invalid:asc');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsers);
    });
  });

  describe('GET /users/:id', () => {
    it('should return a single user', async () => {
      const mockUser = { 
        id: 1, 
        name: 'John Doe', 
        email: 'john@example.com', 
        type: 'user',
        image: null 
      };

      mockDb.query.mockImplementation((query, params, callback) => {
        if (query.includes('WHERE id = ?') && params[0] === '1') {
          callback(null, [mockUser]);
        } else {
          callback(new Error('Unexpected query'));
        }
      });

      const response = await request(app).get('/users/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUser);
    });

    it('should handle database error', async () => {
      const mockError = new Error('Database error');
      mockDb.query.mockImplementation((query, params, callback) => {
        callback(mockError);
      });

      const response = await request(app).get('/users/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Server error' });
    });

    it('should return 404 for non-existent user', async () => {
      mockDb.query.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/users/999');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });
  });

  describe('POST /users', () => {
    const validUser = {
      name: 'John Doe',
      email: 'john@example.com',
      type: 'user'
    };

    it('should create a new user', async () => {
      mockDb.query
        .mockImplementationOnce((query, params, callback) => {
          // First query checks if email exists
          callback(null, []);
        })
        .mockImplementationOnce((query, params, callback) => {
          // Second query inserts the user
          callback(null, { insertId: 1 });
        });

      const response = await request(app)
        .post('/users')
        .send(validUser);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        ...validUser,
        image: null
      });
    });

    it('should handle database error during email check', async () => {
      const mockError = new Error('Database error');
      mockDb.query.mockImplementation((query, params, callback) => {
        callback(mockError);
      });

      const response = await request(app)
        .post('/users')
        .send(validUser);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Server error' });
    });

    it('should handle database error during user creation', async () => {
      mockDb.query
        .mockImplementationOnce((query, params, callback) => {
          // First query checks if email exists
          callback(null, []);
        })
        .mockImplementationOnce((query, params, callback) => {
          // Second query fails to insert the user
          callback(new Error('Database error'));
        });

      const response = await request(app)
        .post('/users')
        .send(validUser);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Server error' });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/users')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should prevent duplicate emails', async () => {
      mockDb.query.mockImplementation((query, params, callback) => {
        callback(null, [{ id: 1 }]);
      });

      const response = await request(app)
        .post('/users')
        .send(validUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email already exists');
    });
  });

  describe('PATCH /users/:id', () => {
    const validUpdate = {
      name: 'John Updated',
      email: 'john.updated@example.com',
      type: 'admin'
    };

    it('should update an existing user', async () => {
      mockDb.query
        .mockImplementationOnce((query, params, callback) => {
          // First query checks if email exists for other users
          callback(null, []);
        })
        .mockImplementationOnce((query, params, callback) => {
          // Second query updates the user
          callback(null, { affectedRows: 1 });
        });

      const response = await request(app)
        .patch('/users/1')
        .send(validUpdate);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        ...validUpdate,
        image: null
      });
    });

    it('should handle database error during email check', async () => {
      const mockError = new Error('Database error');
      mockDb.query.mockImplementation((query, params, callback) => {
        callback(mockError);
      });

      const response = await request(app)
        .patch('/users/1')
        .send(validUpdate);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Server error' });
    });

    it('should handle database error during update', async () => {
      mockDb.query
        .mockImplementationOnce((query, params, callback) => {
          // First query checks if email exists for other users
          callback(null, []);
        })
        .mockImplementationOnce((query, params, callback) => {
          // Second query fails to update the user
          callback(new Error('Database error'));
        });

      const response = await request(app)
        .patch('/users/1')
        .send(validUpdate);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Server error' });
    });

    it('should return 404 for non-existent user', async () => {
      mockDb.query
        .mockImplementationOnce((query, params, callback) => {
          // First query checks if email exists for other users
          callback(null, []);
        })
        .mockImplementationOnce((query, params, callback) => {
          // Second query updates the user
          callback(null, { affectedRows: 0 });
        });

      const response = await request(app)
        .patch('/users/999')
        .send(validUpdate);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .patch('/users/1')
        .send({
          name: '',
          email: 'invalid-email',
          type: 'invalid-type'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete an existing user', async () => {
      mockDb.query.mockImplementation((query, params, callback) => {
        callback(null, { affectedRows: 1 });
      });

      const response = await request(app).delete('/users/1');
      expect(response.status).toBe(204);
    });

    it('should handle database error', async () => {
      const mockError = new Error('Database error');
      mockDb.query.mockImplementation((query, params, callback) => {
        callback(mockError);
      });

      const response = await request(app).delete('/users/1');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Server error' });
    });

    it('should return 404 for non-existent user', async () => {
      mockDb.query.mockImplementation((query, params, callback) => {
        callback(null, { affectedRows: 0 });
      });

      const response = await request(app).delete('/users/999');
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });
  });
}); 