import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import {readFileSync} from "fs";
import {SqlChanges} from "./typings/SqlChanges.ts";

const FILENAME_UP_PREFIX = "up_to_";
const FILENAME_DOWN_PREFIX = "down_to_";

export default class MigrationHistoryManager {
	private readonly configPath: string;
	private readonly migrationsPath: string;
	private lastVersion: number = 0;
	
	constructor(configPath: string) {
		this.configPath = configPath;
		this.migrationsPath = `${configPath}/migrations/`;
		mkdirSync(this.configPath, {recursive: true});
		mkdirSync(this.migrationsPath, {recursive: true});
	}
	
	getLastHistoryVersion(): number {
		if(this.lastVersion)
			return this.lastVersion;
		const path = `${this.configPath}/last_version.txt`;
		this.lastVersion = existsSync(path)
			? parseInt(readFileSync(`${this.configPath}/last_version.txt`, {encoding: 'utf-8'})) ?? 0
			: 0;
		
		return this.lastVersion;
	}
	setLastHistoryVersion(version: number): void {
		writeFileSync(`${this.configPath}/last_version.txt`, version.toString(), {encoding: 'utf-8'});
	}
	
	createMigrationHistory(toVersion: number, changes: SqlChanges, overwriteExisting?: boolean): void {
		const fromVersion = this.getLastHistoryVersion();
		const upPath = `${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion}.sql`;
		const downPath = `${this.migrationsPath}/${FILENAME_DOWN_PREFIX}${fromVersion}.sql`;
		
		if(existsSync(upPath) && !overwriteExisting)
			throw new Error(`Migration ${upPath} already exists!`);
		else if(existsSync(downPath) && !overwriteExisting)
			throw new Error(`Migration ${downPath} already exists!`);
		
		writeFileSync(`${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion}.sql`, `-- From: Version ${fromVersion}\n-- To:   Version ${toVersion}\n${changes.up}`, {encoding: 'utf-8'})
		writeFileSync(`${this.migrationsPath}/${FILENAME_DOWN_PREFIX}${fromVersion}.sql`, `-- From: Version ${toVersion}\n-- To:   Version ${fromVersion}\n${changes.down}`, {encoding: 'utf-8'})
	}
	getUpMigration(toVersion?: number): string {
		return readFileSync(`${this.migrationsPath}/${FILENAME_UP_PREFIX}${toVersion ?? this.getLastHistoryVersion()}.sql`, {encoding: 'utf-8'});
	}
	getDownMigration(version: number): string {
		return readFileSync(`${this.migrationsPath}/${FILENAME_DOWN_PREFIX}${version}.sql`, {encoding: 'utf-8'});
	}
}