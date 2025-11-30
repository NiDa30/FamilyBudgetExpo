/**
 * Attachment Service
 * Handles file attachments (receipts, photos) for transactions
 * Manages files in Firebase Storage and metadata in Firestore/SQLite
 */

import { DatabaseService } from '../database/database';
import { FirebaseService } from './firebase/FirebaseService';
import { COLLECTIONS } from '../constants/collections';
import * as FileSystem from 'expo-file-system';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from '../firebaseConfig';

const storage = getStorage(app);

const generateID = () => {
  return `ATT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const AttachmentService = {
  /**
   * Upload file to Firebase Storage and create attachment record
   */
  uploadAttachment: async (transactionID, fileUri, userID) => {
    try {
      const attachmentID = generateID();
      const timestamp = new Date().toISOString();

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // Extract file metadata
      const fileName = fileUri.split('/').pop() || `attachment_${Date.now()}`;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = getMimeType(fileExtension);

      // Read file as base64
      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob
      const blob = base64ToBlob(fileBase64, mimeType);

      // Upload to Firebase Storage
      const storagePath = `attachments/${userID}/${transactionID}/${attachmentID}.${fileExtension}`;
      const storageRef = ref(storage, storagePath);
      
      await uploadBytes(storageRef, blob);
      const fileURL = await getDownloadURL(storageRef);

      // Create attachment metadata
      const attachment = {
        attachmentID,
        transactionID,
        fileURL,
        fileName,
        fileType: fileExtension,
        fileSize: fileInfo.size || 0,
        mimeType,
        thumbnailURL: null, // Can generate thumbnail later
        ocrRawText: null, // Will be filled by OCR processing
        ocrConfidence: null,
        wasEdited: false,
        uploadedAt: timestamp,
        uploadedBy: userID,
        createdAt: timestamp
      };

      // Save to SQLite
      const db = DatabaseService.getDB();
      await db.runAsync(
        `INSERT INTO ATTACHMENT (
          attachmentID, transactionID, fileURL, fileName, fileType, fileSize, mimeType,
          thumbnailURL, ocrRawText, ocrConfidence, wasEdited, uploadedAt, uploadedBy, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          attachment.attachmentID,
          attachment.transactionID,
          attachment.fileURL,
          attachment.fileName,
          attachment.fileType,
          attachment.fileSize,
          attachment.mimeType,
          attachment.thumbnailURL,
          attachment.ocrRawText,
          attachment.ocrConfidence,
          attachment.wasEdited ? 1 : 0,
          attachment.uploadedAt,
          attachment.uploadedBy,
          attachment.createdAt
        ]
      );

      // Update transaction hasAttachment flag
      await db.runAsync(
        `UPDATE TRANSACTION SET hasAttachment = 1 WHERE transactionID = ?`,
        [transactionID]
      );

      // Sync to Firebase
      try {
        await FirebaseService.addDocument(COLLECTIONS.ATTACHMENT, attachment);
        await FirebaseService.updateDocument(COLLECTIONS.TRANSACTIONS, transactionID, {
          hasAttachment: true
        });
      } catch (firebaseError) {
        console.error('Error syncing attachment to Firebase:', firebaseError);
      }

      return attachment;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw error;
    }
  },

  /**
   * Get all attachments for a transaction
   */
  getTransactionAttachments: async (transactionID) => {
    try {
      const db = DatabaseService.getDB();
      const attachments = await db.getAllAsync(
        `SELECT * FROM ATTACHMENT WHERE transactionID = ? ORDER BY uploadedAt DESC`,
        [transactionID]
      );
      return attachments;
    } catch (error) {
      console.error('Error getting transaction attachments:', error);
      return [];
    }
  },

  /**
   * Get all attachments for a user (across all transactions)
   */
  getAllUserAttachments: async (userID) => {
    try {
      const db = DatabaseService.getDB();
      const attachments = await db.getAllAsync(
        `SELECT a.*, t.description as transactionDescription, t.amount, t.date as transactionDate
         FROM ATTACHMENT a
         INNER JOIN TRANSACTION t ON a.transactionID = t.transactionID
         WHERE t.userID = ?
         ORDER BY a.uploadedAt DESC`,
        [userID]
      );
      return attachments;
    } catch (error) {
      console.error('Error getting user attachments:', error);
      return [];
    }
  },

  /**
   * Get attachment by ID
   */
  getAttachmentById: async (attachmentID) => {
    try {
      const db = DatabaseService.getDB();
      const attachment = await db.getFirstAsync(
        `SELECT * FROM ATTACHMENT WHERE attachmentID = ?`,
        [attachmentID]
      );
      return attachment;
    } catch (error) {
      console.error('Error getting attachment:', error);
      return null;
    }
  },

  /**
   * Delete attachment (file and metadata)
   */
  deleteAttachment: async (attachmentID) => {
    try {
      const db = DatabaseService.getDB();

      // Get attachment info
      const attachment = await db.getFirstAsync(
        `SELECT * FROM ATTACHMENT WHERE attachmentID = ?`,
        [attachmentID]
      );

      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Delete from Firebase Storage
      try {
        const fileUrl = attachment.fileURL;
        if (fileUrl) {
          // Extract storage path from URL
          const storageRef = ref(storage, fileUrl);
          await deleteObject(storageRef);
        }
      } catch (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue even if storage deletion fails
      }

      // Delete from SQLite
      await db.runAsync(
        `DELETE FROM ATTACHMENT WHERE attachmentID = ?`,
        [attachmentID]
      );

      // Update transaction hasAttachment flag if no more attachments
      const remainingAttachments = await db.getFirstAsync(
        `SELECT COUNT(*) as count FROM ATTACHMENT WHERE transactionID = ?`,
        [attachment.transactionID]
      );

      if (remainingAttachments.count === 0) {
        await db.runAsync(
          `UPDATE TRANSACTION SET hasAttachment = 0 WHERE transactionID = ?`,
          [attachment.transactionID]
        );
      }

      // Sync to Firebase
      try {
        await FirebaseService.deleteDocument(COLLECTIONS.ATTACHMENT, attachmentID);
        
        if (remainingAttachments.count === 0) {
          await FirebaseService.updateDocument(COLLECTIONS.TRANSACTIONS, attachment.transactionID, {
            hasAttachment: false
          });
        }
      } catch (firebaseError) {
        console.error('Error syncing attachment deletion to Firebase:', firebaseError);
      }

      return true;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      throw error;
    }
  },

  /**
   * Update attachment OCR data
   */
  updateOCRData: async (attachmentID, ocrRawText, ocrConfidence) => {
    try {
      const db = DatabaseService.getDB();

      await db.runAsync(
        `UPDATE ATTACHMENT SET ocrRawText = ?, ocrConfidence = ? WHERE attachmentID = ?`,
        [ocrRawText, ocrConfidence, attachmentID]
      );

      // Sync to Firebase
      try {
        await FirebaseService.updateDocument(COLLECTIONS.ATTACHMENT, attachmentID, {
          ocrRawText,
          ocrConfidence
        });
      } catch (firebaseError) {
        console.error('Error syncing OCR data to Firebase:', firebaseError);
      }

      return true;
    } catch (error) {
      console.error('Error updating OCR data:', error);
      throw error;
    }
  },

  /**
   * Mark attachment as edited
   */
  markAsEdited: async (attachmentID) => {
    try {
      const db = DatabaseService.getDB();

      await db.runAsync(
        `UPDATE ATTACHMENT SET wasEdited = 1 WHERE attachmentID = ?`,
        [attachmentID]
      );

      // Sync to Firebase
      try {
        await FirebaseService.updateDocument(COLLECTIONS.ATTACHMENT, attachmentID, {
          wasEdited: true
        });
      } catch (firebaseError) {
        console.error('Error syncing edited flag to Firebase:', firebaseError);
      }

      return true;
    } catch (error) {
      console.error('Error marking attachment as edited:', error);
      throw error;
    }
  },

  /**
   * Get storage statistics for a user
   */
  getStorageStats: async (userID) => {
    try {
      const db = DatabaseService.getDB();
      const stats = await db.getFirstAsync(
        `SELECT 
          COUNT(*) as totalAttachments,
          COALESCE(SUM(fileSize), 0) as totalSize,
          COALESCE(AVG(fileSize), 0) as avgSize,
          COALESCE(MAX(fileSize), 0) as maxSize
         FROM ATTACHMENT a
         INNER JOIN TRANSACTION t ON a.transactionID = t.transactionID
         WHERE t.userID = ?`,
        [userID]
      );

      return {
        totalAttachments: stats?.totalAttachments || 0,
        totalSize: stats?.totalSize || 0,
        avgSize: stats?.avgSize || 0,
        maxSize: stats?.maxSize || 0,
        totalSizeMB: ((stats?.totalSize || 0) / (1024 * 1024)).toFixed(2),
        quota: 100, // 100MB default quota per user
        usagePercent: (((stats?.totalSize || 0) / (100 * 1024 * 1024)) * 100).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        totalAttachments: 0,
        totalSize: 0,
        avgSize: 0,
        maxSize: 0,
        totalSizeMB: '0.00',
        quota: 100,
        usagePercent: '0.00'
      };
    }
  },

  /**
   * Search attachments by OCR text
   */
  searchAttachments: async (userID, searchTerm) => {
    try {
      const db = DatabaseService.getDB();
      const attachments = await db.getAllAsync(
        `SELECT a.*, t.description as transactionDescription, t.amount, t.date as transactionDate
         FROM ATTACHMENT a
         INNER JOIN TRANSACTION t ON a.transactionID = t.transactionID
         WHERE t.userID = ? AND (
           a.ocrRawText LIKE ? OR
           a.fileName LIKE ? OR
           t.description LIKE ?
         )
         ORDER BY a.uploadedAt DESC`,
        [userID, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
      );
      return attachments;
    } catch (error) {
      console.error('Error searching attachments:', error);
      return [];
    }
  },

  /**
   * Download attachment for local viewing
   */
  downloadAttachment: async (attachmentID) => {
    try {
      const db = DatabaseService.getDB();
      const attachment = await db.getFirstAsync(
        `SELECT * FROM ATTACHMENT WHERE attachmentID = ?`,
        [attachmentID]
      );

      if (!attachment) {
        throw new Error('Attachment not found');
      }

      // Download file to local cache
      const localUri = `${FileSystem.cacheDirectory}${attachment.fileName}`;
      const downloadResult = await FileSystem.downloadAsync(
        attachment.fileURL,
        localUri
      );

      return {
        ...attachment,
        localUri: downloadResult.uri
      };
    } catch (error) {
      console.error('Error downloading attachment:', error);
      throw error;
    }
  },

  /**
   * Bulk delete attachments
   */
  bulkDeleteAttachments: async (attachmentIDs) => {
    try {
      const results = {
        success: [],
        failed: []
      };

      for (const attachmentID of attachmentIDs) {
        try {
          await AttachmentService.deleteAttachment(attachmentID);
          results.success.push(attachmentID);
        } catch (error) {
          console.error(`Error deleting attachment ${attachmentID}:`, error);
          results.failed.push(attachmentID);
        }
      }

      return results;
    } catch (error) {
      console.error('Error bulk deleting attachments:', error);
      throw error;
    }
  }
};

/**
 * Helper: Get MIME type from file extension
 */
function getMimeType(extension) {
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    heic: 'image/heic',
    heif: 'image/heif'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Helper: Convert base64 to blob
 */
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: mimeType });
}

export default AttachmentService;
