import {MigrationManager} from "./lib/MigrationManager.ts";
import {type DatabaseAccess} from "./lib/typings/DatabaseAccess.ts";
import type DatabaseInstructions from "./lib/typings/DatabaseInstructions.ts";
import {Logger} from "./lib/Logger.ts";
import TableClass from "./lib/tableInfo/decorators/TableClass.ts";
import TableObj from "./lib/tableInfo/TableObj.ts";
import DataType from "./lib/tableInfo/decorators/DataType.ts";
import ForeignKey from "./lib/tableInfo/decorators/ForeignKey.ts";
import Index from "./lib/tableInfo/decorators/Index.ts";
import getDialect from "./lib/getDialect.ts";
import {type PublicMigrations} from "./lib/Migrations.ts";
import {type SqlChanges} from "./lib/typings/SqlChanges.ts";

/**
 * Executes a database migration based on the provided database connection and migration instructions.
 *
 * @param db - The database access object used to interact with the database.
 * @param dbInstructions - The migration instructions, including target version, logger mode, and dialect.
 * @return A promise that resolves when the migration process is successfully completed.
 */
export async function runMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions) {
	Logger.setMode(dbInstructions.loggerMode);
	const dialect = getDialect(db, dbInstructions.dialect);
	
	const mm = new MigrationManager(dialect);
	const migration = await mm.generateSqlChanges(dbInstructions);
	
	if(migration) {
		await db.createBackup?.(`from_${migration.fromVersion}_to_${dbInstructions.version}`);
		await dialect.runTransactionWithoutForeignKeys(migration.changes.up);
		await dialect.setChanges(migration.fromVersion, dbInstructions.version, migration.changes);
	}
}

/**
 * Rolls back the database to the provided toVersion
 * @param dbAccess - Access to the database.
 * @param toVersion - the version to which the database should be upgraded to.
 * @param dialect - the dialect that should be used for the database. Usually is the value defined in DatabaseInstructions
 * @param loggerMode - defines how much should be logged to the console.
 */
export async function rollback(dbAccess: DatabaseAccess, toVersion: number, dialect: DatabaseInstructions["dialect"], loggerMode?: DatabaseInstructions["loggerMode"]): Promise<number> {
	Logger.setMode(loggerMode);
	const sql = getDialect(dbAccess, dialect);
	const fromVersion = await sql.getVersion();
	
	// At the start of the loop, we get the history entry that got us to the current version and then use its fromVersion as current version
	// Until the current version is smaller of the same as thw provided `toVersion`
	await dbAccess.createBackup?.(`from_${fromVersion}_to_${toVersion}`);
	Logger.log(`Rolling back from ${fromVersion} to ${toVersion}`);
	let version = fromVersion;
	while(version > toVersion) {
		const changes = await sql.getChanges(version);
		if(!changes) { // Should never happen
			throw new Error(`Unexpected error! No changes were found from version ${version} (fromVersion: ${fromVersion}, toVersion: ${toVersion})`);
		}
		else if(changes.fromVersion == version) {
			throw new Error(`Saved changes do not change the database version (${version})`);
		}
		Logger.debug(changes.down);
		
		await sql.runTransactionWithoutForeignKeys(changes.down);
		
		version = changes.fromVersion;
	}
	
	if(version < toVersion) {
		Logger.warn(`There was no entry for version ${toVersion}. Rolled back to version ${version}`);
	}
	await sql.rollbackHistory(version);
	
	return version;
}

export {
	DataType,
	ForeignKey,
	Index,
	TableClass,
	TableObj,
	DatabaseAccess,
	DatabaseInstructions,
	PublicMigrations,
	SqlChanges
};