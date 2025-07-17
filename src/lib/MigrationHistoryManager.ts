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
	private lastVersion: number = 0;
	
	constructor(configPath: string) {
		this.configPath = configPath;
		this.migrationsPath = `${configPath}/migrations`;
		mkdirSync(this.configPath, {recursive: true});
		mkdirSync(this.migrationsPath, {recursive: true});
	}
	
	/**
	 * Retrieves the last recorded history version from the configuration path.
	 * If the version is not already cached in memory, this method reads it from a file on disk.
	 *
	 * @return The last version number, or 0 if the version file does not exist or cannot be parsed.
	 */
	public getLastHistoryVersion(): number {
		if(this.lastVersion)
			return this.lastVersion;
		const path = `${this.configPath}/last_version.txt`;
		this.lastVersion = existsSync(path)
			? parseInt(readFileSync(`${this.configPath}/last_version.txt`, {encoding: 'utf-8'})) ?? 0
			: 0;
		
		return this.lastVersion;
	}
	/**
	 * Updates the "last history version" information by writing the given version to a file.
	 *
	 * @param version - The version number to set as the last history version.
	 */
	public setLastHistoryVersion(version: number): void {
		writeFileSync(`${this.configPath}/last_version.txt`, version.toString(), {encoding: 'utf-8'});
	}
	
	/**
	 * Creates migration history files for upgrading and downgrading database schemas.
	 *
	 * @param toVersion - The target version number for the migration.
	 * @param changes - An object containing the SQL changes for upgrading (`changes.up`) and downgrading (`changes.down`).
	 * @param overwriteExisting - A flag that determines if existing migration files should be overwritten. Defaults to `false`.
	 */
	public createMigrationHistory(toVersion: number, changes: SqlChanges, overwriteExisting?: boolean): void {
		const fromVersion = this.getLastHistoryVersion();
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
	public getUpMigration(toVersion?: number): string {
		return readFileSync(`${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion ?? this.getLastHistoryVersion()}.sql`, {encoding: 'utf-8'});
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