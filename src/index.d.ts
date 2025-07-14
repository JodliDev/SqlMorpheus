import {DatabaseAccess} from "./lib/typings/DatabaseAccess";
import DatabaseInstructions from "./lib/typings/DatabaseInstructions";

export async function prepareMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void>;
export async function runPreparedMigrations(db: DatabaseAccess, dbInstructions: DatabaseInstructions);
export async function prepareAndRunMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void>;
export async function rollback(db: DatabaseAccess, dbInstructions: DatabaseInstructions, toVersion: number);