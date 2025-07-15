import {MigrationManager} from "./lib/MigrationManager";
import {DatabaseAccess} from "./lib/typings/DatabaseAccess";
import DatabaseInstructions from "./lib/typings/DatabaseInstructions";
import MigrationHistoryManager from "./lib/MigrationHistoryManager";
import {Logger} from "./lib/Logger";

export async function prepareMigration(db: DatabaseAccess, instructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void> {
	Logger.setMode(instructions.loggerMode);
	const mm = new MigrationManager(db, instructions);
	await mm.prepareMigration(overwriteExisting);
}

export async function runPreparedMigrations(db: DatabaseAccess, instructions: DatabaseInstructions) {
	Logger.setMode(instructions.loggerMode);
	const migrationHistoryManager = new MigrationHistoryManager(instructions.configPath);
	
	const fromVersion = migrationHistoryManager.getLastHistoryVersion();
	const toVersion = instructions.version;
	if(fromVersion == toVersion)
		return;
	
	Logger.log(`Running migrations from ${fromVersion} to ${toVersion}`);
	for(let i= fromVersion ? fromVersion + 1 : toVersion; i <= toVersion; ++i) {
		const upChanges = migrationHistoryManager.getUpMigration(i);
		Logger.debug(upChanges);
		await db.runMultipleWriteStatements(upChanges);
		instructions.version = i;
	}
	migrationHistoryManager.setLastHistoryVersion(toVersion);
}

export async function prepareAndRunMigration(db: DatabaseAccess, instructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void> {
	Logger.setMode(instructions.loggerMode);
	await prepareMigration(db, instructions, overwriteExisting);
	await runPreparedMigrations(db, instructions);
}

export async function rollback(db: DatabaseAccess, instructions: DatabaseInstructions, toVersion: number) {
	Logger.setMode(instructions.loggerMode);
	const migrationHistoryManager = new MigrationHistoryManager(instructions.configPath);
	const fromVersion = migrationHistoryManager.getLastHistoryVersion();
	
	Logger.log(`Rolling back from ${fromVersion} to ${toVersion}`);
	for(let i= fromVersion - 1; i >= toVersion; --i) {
		const upChanges = migrationHistoryManager.getDownMigration(i);
		Logger.debug(upChanges);
		await db.runMultipleWriteStatements(upChanges);
		instructions.version = i;
	}
	migrationHistoryManager.setLastHistoryVersion(toVersion);
}