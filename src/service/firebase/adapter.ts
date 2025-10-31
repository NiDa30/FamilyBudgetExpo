import { db } from "../../firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { Transaction, UUID } from "../../domain/types";

export const FirestoreAdapter = {
  async getTransactionsByUser(
    userId: UUID,
    lastModifiedAfter?: string
  ): Promise<Transaction[]> {
    let q = query(
      collection(db, "transactions"),
      where("userId", "==", userId)
    );
    if (lastModifiedAfter) {
      q = query(
        collection(db, "transactions"),
        where("userId", "==", userId),
        where("lastModifiedAt", ">", lastModifiedAfter)
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  },

  async upsertTransactions(transactions: Transaction[]): Promise<void> {
    const batch = writeBatch(db);
    for (const t of transactions) {
      const ref = doc(collection(db, "transactions"), t.id);
      batch.set(ref, t, { merge: true });
    }
    await batch.commit();
  },

  async deleteTransactions(ids: UUID[]): Promise<void> {
    const batch = writeBatch(db);
    for (const id of ids) {
      batch.delete(doc(db, "transactions", id));
    }
    await batch.commit();
  },
};
