import {DatabaseAccess} from "./lib/typings/DatabaseAccess";
import DatabaseInstructions from "./lib/typings/DatabaseInstructions";
import {BackendTable} from "./lib/typings/BackendTable";
import DbTable from "./lib/tableInfo/decorators/DbTable.ts";
import ForeignKey from "./lib/tableInfo/decorators/ForeignKey.ts";

export async function prepareMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void>;
export async function runPreparedMigrations(db: DatabaseAccess, dbInstructions: DatabaseInstructions);
export async function prepareAndRunMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void>;
export async function rollback(db: DatabaseAccess, dbInstructions: DatabaseInstructions, toVersion: number);

export {DbTable, ForeignKey};