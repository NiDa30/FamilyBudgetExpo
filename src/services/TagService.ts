/**
 * Tag Service
 * Handles CRUD operations for tags in SQLite and Firebase
 */

import { DatabaseService } from '../database/database';
import { FirebaseService } from './firebase/FirebaseService';
import { COLLECTIONS } from '../constants/collections';

const generateID = () => {
  return `TAG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const TagService = {
  /**
   * Get all tags for a user
   */
  getAllTags: async (userID) => {
    try {
      const db = DatabaseService.getDB();
      const tags = await db.getAllAsync(
        `SELECT * FROM TAG WHERE userID = ? ORDER BY usageCount DESC, name ASC`,
        [userID]
      );
      return tags;
    } catch (error) {
      console.error('Error getting tags:', error);
      return [];
    }
  },

  /**
   * Get tag by ID
   */
  getTagById: async (tagID) => {
    try {
      const db = DatabaseService.getDB();
      const tag = await db.getFirstAsync(
        `SELECT * FROM TAG WHERE tagID = ?`,
        [tagID]
      );
      return tag;
    } catch (error) {
      console.error('Error getting tag:', error);
      return null;
    }
  },

  /**
   * Create new tag
   */
  createTag: async (userID, tagData) => {
    try {
      const tagID = generateID();
      const timestamp = new Date().toISOString();

      const tag = {
        tagID,
        userID,
        name: tagData.name,
        color: tagData.color || '#808080',
        icon: tagData.icon || 'tag',
        description: tagData.description || '',
        usageCount: 0,
        createdAt: timestamp
      };

      // Insert into SQLite
      const db = DatabaseService.getDB();
      await db.runAsync(
        `INSERT INTO TAG (tagID, userID, name, color, icon, description, usageCount, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tag.tagID, tag.userID, tag.name, tag.color, tag.icon, tag.description, tag.usageCount, tag.createdAt]
      );

      // Sync to Firebase
      try {
        await FirebaseService.addDocument(COLLECTIONS.TAG, tag);
      } catch (firebaseError) {
        console.error('Error syncing tag to Firebase:', firebaseError);
      }

      return tag;
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  },

  /**
   * Update tag
   */
  updateTag: async (tagID, updates) => {
    try {
      const db = DatabaseService.getDB();

      // Build update query dynamically
      const updateFields = [];
      const values = [];

      if (updates.name !== undefined) {
        updateFields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.color !== undefined) {
        updateFields.push('color = ?');
        values.push(updates.color);
      }
      if (updates.icon !== undefined) {
        updateFields.push('icon = ?');
        values.push(updates.icon);
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?');
        values.push(updates.description);
      }

      if (updateFields.length === 0) {
        return;
      }

      values.push(tagID);

      await db.runAsync(
        `UPDATE TAG SET ${updateFields.join(', ')} WHERE tagID = ?`,
        values
      );

      // Sync to Firebase
      try {
        const updateData = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.color !== undefined) updateData.color = updates.color;
        if (updates.icon !== undefined) updateData.icon = updates.icon;
        if (updates.description !== undefined) updateData.description = updates.description;

        await FirebaseService.updateDocument(COLLECTIONS.TAG, tagID, updateData);
      } catch (firebaseError) {
        console.error('Error syncing tag update to Firebase:', firebaseError);
      }

      return true;
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  },

  /**
   * Delete tag (and remove from all transactions)
   */
  deleteTag: async (tagID) => {
    try {
      const db = DatabaseService.getDB();

      // Delete tag-transaction relationships first
      await db.runAsync(`DELETE FROM TRANSACTION_TAG WHERE tagID = ?`, [tagID]);
      await db.runAsync(`DELETE FROM TAG WHERE tagID = ?`, [tagID]);

      // Sync to Firebase
      try {
        // Delete tag from Firebase
        await FirebaseService.deleteDocument(COLLECTIONS.TAG, tagID);

        // Delete all transaction-tag relationships
        const transactionTags = await FirebaseService.queryDocuments(
          COLLECTIONS.TRANSACTION_TAG,
          [{ field: 'tagID', operator: '==', value: tagID }]
        );

        for (const transactionTag of transactionTags) {
          await FirebaseService.deleteDocument(COLLECTIONS.TRANSACTION_TAG, transactionTag.id);
        }
      } catch (firebaseError) {
        console.error('Error syncing tag deletion to Firebase:', firebaseError);
      }

      return true;
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  },

  /**
   * Add tag to transaction
   */
  addTagToTransaction: async (transactionID, tagID) => {
    try {
      const db = DatabaseService.getDB();
      const id = `TT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      // Check if already tagged
      const existing = await db.getFirstAsync(
        `SELECT * FROM TRANSACTION_TAG WHERE transactionID = ? AND tagID = ?`,
        [transactionID, tagID]
      );

      if (existing) {
        return existing;
      }

      // Add tag to transaction
      await db.runAsync(
        `INSERT INTO TRANSACTION_TAG (id, transactionID, tagID, taggedAt) VALUES (?, ?, ?, ?)`,
        [id, transactionID, tagID, timestamp]
      );

      // Increment usage count
      await db.runAsync(
        `UPDATE TAG SET usageCount = usageCount + 1 WHERE tagID = ?`,
        [tagID]
      );

      // Sync to Firebase
      try {
        await FirebaseService.addDocument(COLLECTIONS.TRANSACTION_TAG, {
          id,
          transactionID,
          tagID,
          taggedAt: timestamp
        });

        // Update usage count in Firebase
        const tag = await FirebaseService.getDocument(COLLECTIONS.TAG, tagID);
        if (tag) {
          await FirebaseService.updateDocument(COLLECTIONS.TAG, tagID, {
            usageCount: (tag.usageCount || 0) + 1
          });
        }
      } catch (firebaseError) {
        console.error('Error syncing transaction tag to Firebase:', firebaseError);
      }

      return { id, transactionID, tagID, taggedAt: timestamp };
    } catch (error) {
      console.error('Error adding tag to transaction:', error);
      throw error;
    }
  },

  /**
   * Remove tag from transaction
   */
  removeTagFromTransaction: async (transactionID, tagID) => {
    try {
      const db = DatabaseService.getDB();

      // Remove tag from transaction
      await db.runAsync(
        `DELETE FROM TRANSACTION_TAG WHERE transactionID = ? AND tagID = ?`,
        [transactionID, tagID]
      );

      // Decrement usage count
      await db.runAsync(
        `UPDATE TAG SET usageCount = GREATEST(0, usageCount - 1) WHERE tagID = ?`,
        [tagID]
      );

      // Sync to Firebase
      try {
        const transactionTags = await FirebaseService.queryDocuments(
          COLLECTIONS.TRANSACTION_TAG,
          [
            { field: 'transactionID', operator: '==', value: transactionID },
            { field: 'tagID', operator: '==', value: tagID }
          ]
        );

        for (const transactionTag of transactionTags) {
          await FirebaseService.deleteDocument(COLLECTIONS.TRANSACTION_TAG, transactionTag.id);
        }

        // Update usage count in Firebase
        const tag = await FirebaseService.getDocument(COLLECTIONS.TAG, tagID);
        if (tag) {
          await FirebaseService.updateDocument(COLLECTIONS.TAG, tagID, {
            usageCount: Math.max(0, (tag.usageCount || 1) - 1)
          });
        }
      } catch (firebaseError) {
        console.error('Error syncing transaction tag removal to Firebase:', firebaseError);
      }

      return true;
    } catch (error) {
      console.error('Error removing tag from transaction:', error);
      throw error;
    }
  },

  /**
   * Get tags for a transaction
   */
  getTransactionTags: async (transactionID) => {
    try {
      const db = DatabaseService.getDB();
      const tags = await db.getAllAsync(
        `SELECT t.* FROM TAG t
         INNER JOIN TRANSACTION_TAG tt ON t.tagID = tt.tagID
         WHERE tt.transactionID = ?
         ORDER BY t.name ASC`,
        [transactionID]
      );
      return tags;
    } catch (error) {
      console.error('Error getting transaction tags:', error);
      return [];
    }
  },

  /**
   * Search tags
   */
  searchTags: async (userID, searchTerm) => {
    try {
      const db = DatabaseService.getDB();
      const tags = await db.getAllAsync(
        `SELECT * FROM TAG 
         WHERE userID = ? AND name LIKE ?
         ORDER BY usageCount DESC, name ASC`,
        [userID, `%${searchTerm}%`]
      );
      return tags;
    } catch (error) {
      console.error('Error searching tags:', error);
      return [];
    }
  },

  /**
   * Get popular tags
   */
  getPopularTags: async (userID, limit = 10) => {
    try {
      const db = DatabaseService.getDB();
      const tags = await db.getAllAsync(
        `SELECT * FROM TAG 
         WHERE userID = ?
         ORDER BY usageCount DESC
         LIMIT ?`,
        [userID, limit]
      );
      return tags;
    } catch (error) {
      console.error('Error getting popular tags:', error);
      return [];
    }
  }
};

export default TagService;
