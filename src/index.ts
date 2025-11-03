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

export async function runMigration(db: DatabaseAccess, dbInstructions: DatabaseInstructions) {
	Logger.setMode(dbInstructions.loggerMode);
	const dialect = getDialect(db, dbInstructions);
	
	const mm = new MigrationManager(dialect);
	const migration = await mm.generateSqlChanges(dbInstructions);
	
	if(migration) {
		await dialect.setChanges(migration.fromVersion, dbInstructions.version, migration.changes);
		
		await db.createBackup?.(`from_${migration.fromVersion}_to_${dbInstructions.version}`);
		await db.runTransaction(migration.changes.up);
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
		
		await db.runTransaction(changes.down);
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