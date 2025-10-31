import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { TransactionRepository } from "../../database/repositories";
import { FirestoreAdapter } from "../firebase/adapter";
import { Transaction, UUID } from "../../domain/types";

type ConflictResolution = "last-write-wins" | "prefer-local" | "prefer-remote";

export class SyncService {
  private isSyncing = false;
  private strategy: ConflictResolution = "last-write-wins";

  constructor(strategy?: ConflictResolution) {
    if (strategy) this.strategy = strategy;
  }

  async sync(
    userId: UUID,
    force: boolean = false
  ): Promise<{ pushed: number; pulled: number }> {
    if (this.isSyncing) return { pushed: 0, pulled: 0 };
    const net = await NetInfo.fetch();
    if (!net.isConnected) return { pushed: 0, pulled: 0 };

    this.isSyncing = true;
    try {
      const lastSync = (await AsyncStorage.getItem("lastSyncAt")) || undefined;

      // Push local changes
      const unsynced = await TransactionRepository.getUnsynced(userId);
      if (unsynced.length) {
        await this.pushLocal(userId, unsynced);
      }

      // Pull remote changes
      const shouldPull = force || !lastSync || unsynced.length === 0;
      let pulled = 0;
      if (shouldPull) {
        pulled = await this.pullRemote(userId, lastSync);
      }

      await AsyncStorage.setItem("lastSyncAt", new Date().toISOString());
      return { pushed: unsynced.length, pulled };
    } finally {
      this.isSyncing = false;
    }
  }

  private async pushLocal(userId: UUID, localChanges: Transaction[]) {
    const now = new Date().toISOString();
    // Mark lastModifiedAt before push
    const toPush = localChanges.map((t) => ({
      ...t,
      lastModifiedAt: t.lastModifiedAt || now,
    }));
    await FirestoreAdapter.upsertTransactions(toPush);
    await TransactionRepository.markSynced(
      toPush.map((t) => t.id),
      now
    );
  }

  private async pullRemote(userId: UUID, lastSync?: string): Promise<number> {
    const remote = await FirestoreAdapter.getTransactionsByUser(
      userId,
      lastSync
    );
    if (!remote.length) return 0;
    // Apply conflict resolution
    for (const r of remote) {
      // For now, we rely on INSERT OR REPLACE; last-write-wins by timestamp handled at source of truth
      await TransactionRepository.create(r);
    }
    return remote.length;
  }
}

export const syncService = new SyncService();
