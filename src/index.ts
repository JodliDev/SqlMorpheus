import {MigrationManager} from "./lib/MigrationManager.ts";
import {DatabaseAccess} from "./lib/typings/DatabaseAccess.ts";
import DatabaseInstructions from "./lib/typings/DatabaseInstructions.ts";
import MigrationHistoryManager from "./lib/MigrationHistoryManager.ts";

export async function prepareMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void> {
	const mm = new MigrationManager(db, dbInstructions);
	await mm.prepareMigration(overwriteExisting);
}

export async function runPreparedMigrations(db: DatabaseAccess, dbInstructions: DatabaseInstructions) {
	const migrationHistoryManager = new MigrationHistoryManager(dbInstructions.configPath);
	
	const fromVersion = migrationHistoryManager.getLastHistoryVersion();
	const toVersion = dbInstructions.version;
	if(fromVersion == toVersion)
		return;
	
	for(let i= fromVersion ? fromVersion + 1 : toVersion; i <= toVersion; ++i) {
		const upChanges = migrationHistoryManager.getUpMigration(i);
		console.log(upChanges);
		await db.runMultipleWriteStatements(upChanges);
		dbInstructions.version = i;
	}
	migrationHistoryManager.setLastHistoryVersion(toVersion);
}

export async function prepareAndRunMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void> {
	await prepareMigration(db, dbInstructions, overwriteExisting);
	await runPreparedMigrations(db, dbInstructions);
}

export async function rollback(db: DatabaseAccess, dbInstructions: DatabaseInstructions, toVersion: number) {
	const migrationHistoryManager = new MigrationHistoryManager(dbInstructions.configPath);
	const fromVersion = migrationHistoryManager.getLastHistoryVersion();
	
	console.log(`Rolling back from ${fromVersion} to ${toVersion}`);
	for(let i= fromVersion - 1; i >= toVersion; --i) {
		const upChanges = migrationHistoryManager.getDownMigration(i);
		console.log(upChanges);
		await db.runMultipleWriteStatements(upChanges);
		dbInstructions.version = i;
	}
	migrationHistoryManager.setLastHistoryVersion(toVersion);
}