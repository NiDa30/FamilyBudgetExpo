// Utility functions for database operations

// Convert JavaScript object to SQL insert statement
export const objectToInsertQuery = (tableName, obj) => {
  const keys = Object.keys(obj);
  const values = Object.values(obj);
  const placeholders = keys.map(() => "?").join(", ");
  const columns = keys.join(", ");

  return {
    query: `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
    params: values,
  };
};

// Convert JavaScript object to SQL update statement
export const objectToUpdateQuery = (
  tableName,
  obj,
  whereClause,
  whereParams = []
) => {
  const keys = Object.keys(obj);
  const values = Object.values(obj);
  const setClause = keys.map((key) => `${key} = ?`).join(", ");

  return {
    query: `UPDATE ${tableName} SET ${setClause} ${whereClause}`,
    params: [...values, ...whereParams],
  };
};

// Format date for SQLite
export const formatDate = (date) => {
  if (typeof date === "string") {
    return date;
  }
  return date.toISOString();
};

// Parse JSON strings from database
export const parseJSON = (jsonString) => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn("Failed to parse JSON:", jsonString);
    return jsonString;
  }
};

// Stringify objects for database storage
export const stringifyJSON = (obj) => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === "string") return obj;
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.warn("Failed to stringify object:", obj);
    return String(obj);
  }
};

// Generate unique ID
export const generateId = () => {
  return "id-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
};

// Validate required fields
export const validateRequiredFields = (obj, requiredFields) => {
  const missingFields = requiredFields.filter(
    (field) =>
      !(field in obj) || obj[field] === null || obj[field] === undefined
  );
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }
  return true;
};

// Convert array to SQLite compatible string
export const arrayToString = (arr) => {
  if (!arr) return null;
  if (Array.isArray(arr)) {
    return JSON.stringify(arr);
  }
  return String(arr);
};

// Convert string to array
export const stringToArray = (str) => {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    return [str];
  }
};

// Export all utilities
export default {
  objectToInsertQuery,
  objectToUpdateQuery,
  formatDate,
  parseJSON,
  stringifyJSON,
  generateId,
  validateRequiredFields,
  arrayToString,
  stringToArray,
};
