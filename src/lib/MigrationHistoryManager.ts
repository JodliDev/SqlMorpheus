import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import {readFileSync} from "fs";
import {SqlChanges} from "./typings/SqlChanges";
import {Logger} from "./Logger";

const FILENAME_UP_PREFIX = "up_to_";
const FILENAME_DOWN_PREFIX = "down_to_";

/**
 * Manages migration history files for versioned data migrations. Provides functionality to track, create,
 * and retrieve migration scripts.
 */
export default class MigrationHistoryManager {
	private readonly configPath: string;
	private readonly migrationsPath: string;
	
	constructor(configPath: string) {
		this.configPath = configPath;
		this.migrationsPath = `${configPath}/migrations`;
		mkdirSync(this.configPath, {recursive: true});
		mkdirSync(this.migrationsPath, {recursive: true});
	}
	
	/**
	 * Creates migration history files for upgrading and downgrading database schemas.
	 *
	 * @param fromVersion - The current version number of the database.
	 * @param toVersion - The target version number for the migration.
	 * @param changes - An object containing the SQL changes for upgrading (`changes.up`) and downgrading (`changes.down`).
	 * @param overwriteExisting - A flag that determines if existing migration files should be overwritten. Defaults to `false`.
	 */
	public createMigrationHistory(fromVersion: number, toVersion: number, changes: SqlChanges, overwriteExisting?: boolean): void {
		const upPath = `${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion}.sql`;
		const downPath = `${this.migrationsPath}/${FILENAME_DOWN_PREFIX}${fromVersion}.sql`;
		
		if(existsSync(upPath) && !overwriteExisting)
			throw new Error(`Migration ${upPath} already exists!`);
		else if(existsSync(downPath) && !overwriteExisting)
			throw new Error(`Migration ${downPath} already exists!`);
		
		Logger.log(`Save migrations to ${this.migrationsPath}`);
		
		writeFileSync(`${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion}.sql`, `-- From: Version ${fromVersion}\n-- To:   Version ${toVersion}\n${changes.up}`, {encoding: 'utf-8'})
		writeFileSync(`${this.migrationsPath}/${FILENAME_DOWN_PREFIX}${fromVersion}.sql`, `-- From: Version ${toVersion}\n-- To:   Version ${fromVersion}\n${changes.down}`, {encoding: 'utf-8'})
	}
	
	/**
	 * Retrieves the SQL migration script for upgrading to the specified version.
	 * If no version is provided, it retrieves the migration script for the latest version in the history.
	 *
	 * @param toVersion - The version of the migration script to retrieve. If not specified, the latest version is used.
	 * @return The content of the SQL migration script as a string.
	 */
	public getUpMigration(toVersion: number): string {
		return readFileSync(`${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion}.sql`, {encoding: 'utf-8'});
	}
	/**
	 * Retrieves the SQL migration script for downgrading to the specified version.
	 *
	 * @param version - The version number of the migration to retrieve.
	 * @return The SQL script for the down migration.
	 */
	public getDownMigration(version: number): string {
		return readFileSync(`${this.migrationsPath}/${FILENAME_DOWN_PREFIX}${version}.sql`, {encoding: 'utf-8'});
	}
}