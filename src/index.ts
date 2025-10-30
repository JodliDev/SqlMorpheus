import {MigrationManager} from "./lib/MigrationManager";
import {DatabaseAccess} from "./lib/typings/DatabaseAccess";
import DatabaseInstructions from "./lib/typings/DatabaseInstructions";
import {Logger} from "./lib/Logger";
import TableClass from "./lib/tableInfo/decorators/TableClass";
import TableObj from "./lib/tableInfo/TableObj";
import DataType from "./lib/tableInfo/decorators/DataType";
import ForeignKey from "./lib/tableInfo/decorators/ForeignKey";
import getDialect from "./lib/getDialect";
import {PublicMigrations} from "./lib/Migrations";
import {SqlChanges} from "./lib/typings/SqlChanges";

export async function prepareMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void> {
	Logger.setMode(dbInstructions.loggerMode);
	const dialect = getDialect(db, dbInstructions);
	
	const mm = new MigrationManager(dialect);
	const migration = await mm.generateSqlChanges(dbInstructions);
	
	if(!migration)
		return;
	const migrationHistoryManager = new MigrationHistoryManager(dbInstructions.configPath);
	migrationHistoryManager.createMigrationHistory(migration.fromVersion, dbInstructions.version, migration.changes, overwriteExisting);
}

export async function runPreparedMigrations(db: DatabaseAccess, dbInstructions: DatabaseInstructions) {
	Logger.setMode(dbInstructions.loggerMode);
	const historyManager = new MigrationHistoryManager(dbInstructions.configPath);
	const dialect = getDialect(db, dbInstructions);
	const fromVersion = await dialect.getVersion();
	const toVersion = dbInstructions.version;
	if(fromVersion == toVersion)
		return;
	
	await db.createBackup?.(`from_${fromVersion}_to_${dbInstructions.version}`);
	Logger.log(`Running migrations from ${fromVersion} to ${toVersion}`);
	for(let i= fromVersion ? fromVersion + 1 : toVersion; i <= toVersion; ++i) {
		const upChanges = historyManager.getUpMigration(i);
		Logger.debug(upChanges);
		await db.runMultipleWriteStatements(upChanges);
		dbInstructions.version = i;
	}
	await dialect.setVersion(toVersion);
}

export async function prepareAndRunMigration(db: DatabaseAccess, instructions: DatabaseInstructions, overwriteExisting?: boolean): Promise<void> {
	Logger.setMode(instructions.loggerMode);
	await prepareMigration(db, instructions, overwriteExisting);
	await runPreparedMigrations(db, instructions);
}

export async function runMigrationWithoutHistory(db: DatabaseAccess, dbInstructions: DatabaseInstructions) {
	Logger.setMode(dbInstructions.loggerMode);
	const dialect = getDialect(db, dbInstructions);
	
	const mm = new MigrationManager(dialect);
	const migration = await mm.generateSqlChanges(dbInstructions);
	
	
	if(migration) {
		await db.createBackup?.(`from_${migration.fromVersion}_to_${dbInstructions.version}`);
		await db.runMultipleWriteStatements(migration.changes.up);
	}
}

export async function rollback(db: DatabaseAccess, dbInstructions: DatabaseInstructions, toVersion: number): Promise<number> {
	Logger.setMode(dbInstructions.loggerMode);
	const dialect = getDialect(db, dbInstructions);
	const fromVersion = await dialect.getVersion();
	
	await db.createBackup?.(`from_${fromVersion}_to_${dbInstructions.version}`);
	Logger.log(`Rolling back from ${fromVersion} to ${toVersion}`);
	let version = fromVersion;
	while(version > toVersion) {
		const changes = await dialect.getChanges(version);
		if(!changes) {
			throw new Error(`No changes found for version ${version}`);
		}
		else if(changes.fromVersion == version) {
			throw new Error(`Saved changes do not change the database version (${version})`);
		}
		Logger.debug(changes.down);
		
		await db.runMultipleWriteStatements(changes.down);
		dbInstructions.version = changes.fromVersion;
		
		version = changes.fromVersion;
	}
	
	if(version < toVersion) {
		Logger.warn(`There was no entry for version ${toVersion}. Rolled back to version ${version}`);
	}
	await dialect.rollbackHistory(version);
	
	return version;
}

export {
	DataType,
	ForeignKey,
	TableClass,
	TableObj,
	DatabaseAccess,
	DatabaseInstructions,
	PublicMigrations,
	SqlChanges
};